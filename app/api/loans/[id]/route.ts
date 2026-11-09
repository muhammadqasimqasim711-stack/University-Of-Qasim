import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { adminDeleteLoan, adminUpdateLoanDates } from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if ((await currentRole()) !== "admin") {
    return signInRequired();
  }

  const { id } = await context.params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId) || loanId < 1) {
    return NextResponse.json({ message: "Loan not found." }, { status: 404 });
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = json.body as Record<string, unknown> | null;
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate.trim() : undefined;
  const issueDate = typeof body?.issueDate === "string" ? body.issueDate.trim() : undefined;

  if (!dueDate && !issueDate) {
    return NextResponse.json(
      { message: "At least one date (dueDate or issueDate) is required." },
      { status: 400 },
    );
  }

  try {
    const updated = await adminUpdateLoanDates(loanId, { dueDate, issueDate });
    return NextResponse.json(updated);
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if ((await currentRole()) !== "admin") {
    return signInRequired();
  }

  const { id } = await context.params;
  const loanId = Number(id);
  if (!Number.isInteger(loanId) || loanId < 1) {
    return NextResponse.json({ message: "Loan not found." }, { status: 404 });
  }

  try {
    await adminDeleteLoan(loanId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
