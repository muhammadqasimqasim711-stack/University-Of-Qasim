import { NextResponse } from "next/server";
import { currentBorrower } from "@/lib/access";
import { borrowerAcceptLoan } from "@/lib/circulation";
import { circulationFailure, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const { id } = await context.params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId) || loanId < 1) {
    return NextResponse.json({ message: "Loan not found." }, { status: 404 });
  }

  try {
    const updated = await borrowerAcceptLoan(borrower, loanId);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
