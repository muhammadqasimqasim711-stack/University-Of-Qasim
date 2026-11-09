import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { adminReturnBook } from "@/lib/circulation";
import { circulationFailure, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const role = await currentRole();
  if (!role) {
    return signInRequired();
  }

  if (role !== "admin") {
    return NextResponse.json(
      { message: "Only an administrator can return a book." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId) || loanId < 1) {
    return NextResponse.json({ message: "Loan not found." }, { status: 404 });
  }

  try {
    const updated = await adminReturnBook(loanId);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
