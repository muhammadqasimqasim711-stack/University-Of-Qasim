import { NextResponse } from "next/server";
import { currentBorrower } from "@/lib/access";
import { reserveBook } from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = json.body as Record<string, unknown> | null;
  const bookId = body && typeof body.bookId === "number" ? body.bookId : 0;
  if (!Number.isInteger(bookId) || bookId < 1) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  try {
    const reservation = await reserveBook(borrower, bookId);
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
