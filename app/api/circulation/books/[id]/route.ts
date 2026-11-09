import { NextResponse } from "next/server";
import { currentBorrower, currentRole } from "@/lib/access";
import { bookCirculation } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const role = await currentRole();
  const borrower =
    (await currentBorrower()) ??
    (role === "admin" ? { role: "student" as const, studentId: 0 } : null);

  if (!borrower) {
    return signInRequired();
  }

  const { id } = await context.params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId) || bookId < 1) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  const circulation = await bookCirculation(bookId, borrower);
  if (!circulation) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }
  return NextResponse.json(circulation);
}
