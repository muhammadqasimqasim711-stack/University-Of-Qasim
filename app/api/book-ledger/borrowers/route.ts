import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { getCirculationConfig, getStartOfCurrentMonth } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Person = {
  id: number;
  fullName: string;
  identifier: string;
  borrowedThisMonth: number;
};

export async function GET(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const url = new URL(request.url);
  const bookId = Number(url.searchParams.get("bookId"));
  const kind = url.searchParams.get("kind");
  if (!Number.isInteger(bookId) || bookId < 1) {
    return NextResponse.json({ message: "Book not found." }, { status: 400 });
  }
  if (kind !== "student" && kind !== "teacher") {
    return NextResponse.json(
      { message: "Choose students or teachers." },
      { status: 400 },
    );
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, bookName: true },
  });
  if (!book) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  const startOfMonth = getStartOfCurrentMonth();
  const config = await getCirculationConfig();
  const monthlyLimit = config.monthlyBorrowLimit;

  const [people, monthLoans, openLoans] = await Promise.all([
    kind === "student"
      ? prisma.student.findMany({
          select: { id: true, fullName: true, rollNumber: true, status: true },
          orderBy: [{ fullName: "asc" }, { id: "asc" }],
        })
      : prisma.teacher.findMany({
          select: { id: true, fullName: true, employeeId: true, status: true },
          orderBy: [{ fullName: "asc" }, { id: "asc" }],
        }),
    prisma.loan.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { studentId: true, teacherId: true },
    }),
    prisma.loan.findMany({
      where: {
        bookId,
        returnedAt: null,
        status: { not: "DECLINED" },
      },
      select: { studentId: true, teacherId: true },
    }),
  ]);

  const monthCount = new Map<number, number>();
  for (const loan of monthLoans) {
    const personId = kind === "student" ? loan.studentId : loan.teacherId;
    if (!personId) {
      continue;
    }
    monthCount.set(personId, (monthCount.get(personId) ?? 0) + 1);
  }

  const holdingIds = new Set<number>();
  for (const loan of openLoans) {
    const personId = kind === "student" ? loan.studentId : loan.teacherId;
    if (personId) {
      holdingIds.add(personId);
    }
  }

  const selectable: Person[] = [];
  const alreadyBorrowed: Person[] = [];
  const monthlyLimitExceeded: Person[] = [];
  for (const person of people) {
    const identifier =
      "rollNumber" in person ? person.rollNumber : person.employeeId;
    const borrowedThisMonth = monthCount.get(person.id) ?? 0;
    const view = {
      id: person.id,
      fullName: person.fullName,
      identifier,
      borrowedThisMonth,
    };
    if (holdingIds.has(person.id)) {
      alreadyBorrowed.push(view);
      continue;
    }
    if (borrowedThisMonth >= monthlyLimit) {
      monthlyLimitExceeded.push(view);
      continue;
    }
    if (person.status === "ACTIVE") {
      selectable.push(view);
    }
  }

  return NextResponse.json({
    bookId: book.id,
    bookName: book.bookName,
    monthlyBorrowLimit: monthlyLimit,
    selectable,
    alreadyBorrowed,
    monthlyLimitExceeded,
  });
}
