import { NextResponse } from "next/server";
import { currentBorrower, currentRole } from "@/lib/access";
import {
  adminIssueBook,
  borrowBook,
  listActiveLoans,
  listBorrowSummary,
  listMyLoans,
  listTotalBooksSummary,
} from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (role === "admin") {
    if (type === "total-books") {
      return NextResponse.json(await listTotalBooksSummary());
    }
    if (type === "student" || type === "teacher") {
      return NextResponse.json(await listBorrowSummary(type));
    }
    return NextResponse.json(await listActiveLoans());
  }

  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  return NextResponse.json(await listMyLoans(borrower));
}

export async function POST(request: Request) {
  const role = await currentRole();
  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = json.body as Record<string, unknown> | null;
  const bookId =
    body && typeof body.bookId === "number" ? body.bookId : 0;
  if (!Number.isInteger(bookId) || bookId < 1) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  if (role === "admin") {
    const studentId =
      typeof body?.studentId === "number" ? body.studentId : undefined;
    const teacherId =
      typeof body?.teacherId === "number" ? body.teacherId : undefined;
    const copyNumber =
      typeof body?.copyNumber === "number" && Number.isInteger(body.copyNumber) && body.copyNumber > 0
        ? body.copyNumber
        : undefined;

    if (!studentId && !teacherId) {
      return NextResponse.json(
        { message: "Select a student or teacher to issue the book to." },
        { status: 400 },
      );
    }

    try {
      const loan = await adminIssueBook(bookId, { studentId, teacherId }, copyNumber);
      return NextResponse.json(loan, { status: 201 });
    } catch (error) {
      return circulationFailure(error) ?? Promise.reject(error);
    }
  }

  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  return NextResponse.json(
    {
      message:
        "Direct borrowing without administrator permission is disabled. Please submit a borrow request from the book page for administrator approval.",
    },
    { status: 403 },
  );
}
