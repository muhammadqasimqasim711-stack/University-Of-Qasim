import { NextResponse } from "next/server";
import { currentBorrower, currentRole } from "@/lib/access";
import {
  adminCreateOverdueLoan,
  listMyOverdueLoans,
  listOverdueLoans,
} from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (role === "admin") {
    const kind =
      type === "student" || type === "teacher"
        ? (type as "student" | "teacher")
        : undefined;
    const loans = await listOverdueLoans(kind);
    return NextResponse.json(loans);
  }

  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const loans = await listMyOverdueLoans(borrower);
  return NextResponse.json(loans);
}

export async function POST(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = json.body as Record<string, unknown> | null;
  const bookId = typeof body?.bookId === "number" ? body.bookId : 0;
  const studentId = typeof body?.studentId === "number" ? body.studentId : undefined;
  const teacherId = typeof body?.teacherId === "number" ? body.teacherId : undefined;
  const issueDate = typeof body?.issueDate === "string" ? body.issueDate.trim() : "";
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate.trim() : "";

  if (!Number.isInteger(bookId) || bookId < 1) {
    return NextResponse.json({ message: "Valid book ID is required." }, { status: 400 });
  }

  if (!studentId && !teacherId) {
    return NextResponse.json(
      { message: "Select a student or teacher to record the loan." },
      { status: 400 },
    );
  }

  if (!issueDate || !dueDate) {
    return NextResponse.json(
      { message: "Issue date and due date are both required." },
      { status: 400 },
    );
  }

  try {
    const loan = await adminCreateOverdueLoan({
      bookId,
      studentId,
      teacherId,
      issueDate,
      dueDate,
    });
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
