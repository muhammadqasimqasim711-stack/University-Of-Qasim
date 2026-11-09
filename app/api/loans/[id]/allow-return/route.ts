import { NextResponse } from "next/server";
import { currentBorrower } from "@/lib/access";
import { allowReturn } from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const { id } = await context.params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId) || loanId < 1) {
    return NextResponse.json({ message: "Loan not found." }, { status: 404 });
  }

  let allow = true;
  const json = await readJson(request);
  if (!("error" in json) && json.body && typeof json.body === "object") {
    const body = json.body as Record<string, unknown>;
    if (typeof body.allow === "boolean") {
      allow = body.allow;
    }
  }

  try {
    const updated = await allowReturn(borrower, loanId, allow);
    return NextResponse.json(updated);
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
