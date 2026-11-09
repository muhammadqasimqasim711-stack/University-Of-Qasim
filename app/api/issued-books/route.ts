import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { utcDateToIsoDate } from "@/lib/dates";
import { signInRequired } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "student" && kind !== "teacher") {
    return NextResponse.json(
      { message: "Choose students or teachers." },
      { status: 400 },
    );
  }

  const loans = await prisma.loan.findMany({
    where: {
      returnedAt: null,
      status: { not: "DECLINED" },
      ...(kind === "student"
        ? { studentId: { not: null } }
        : { teacherId: { not: null } }),
    },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      copyNumber: true,
      issueDate: true,
      dueDate: true,
      book: { select: { bookName: true } },
      student: {
        select: { fullName: true, rollNumber: true, department: true },
      },
      teacher: {
        select: {
          fullName: true,
          employeeId: true,
          department: true,
          designation: true,
        },
      },
    },
  });

  if (kind === "student") {
    return NextResponse.json(
      loans.flatMap((loan) => {
        if (!loan.student) {
          return [];
        }
        return [
          {
            id: loan.id,
            bookName: loan.book.bookName,
            copyNumber: loan.copyNumber > 0 ? loan.copyNumber : 1,
            studentName: loan.student.fullName,
            rollNumber: loan.student.rollNumber,
            department: loan.student.department,
            issueDate: utcDateToIsoDate(loan.issueDate),
            dueDate: utcDateToIsoDate(loan.dueDate),
          },
        ];
      }),
    );
  }

  return NextResponse.json(
    loans.flatMap((loan) => {
      if (!loan.teacher) {
        return [];
      }
      return [
        {
          id: loan.id,
          bookName: loan.book.bookName,
          copyNumber: loan.copyNumber > 0 ? loan.copyNumber : 1,
          teacherName: loan.teacher.fullName,
          employeeId: loan.teacher.employeeId,
          department: loan.teacher.department,
          designation: loan.teacher.designation,
          issueDate: utcDateToIsoDate(loan.issueDate),
          dueDate: utcDateToIsoDate(loan.dueDate),
        },
      ];
    }),
  );
}
