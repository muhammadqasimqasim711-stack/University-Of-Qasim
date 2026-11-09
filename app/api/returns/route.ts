import { NextResponse } from "next/server";
import { currentBorrower, currentRole } from "@/lib/access";
import { listReturnLoans } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "student" || kindParam === "teacher" ? kindParam : undefined;
  const includeReturned = url.searchParams.get("includeReturned") === "true";

  if (role === "admin") {
    const loans = await listReturnLoans({ kind, includeReturned });
    return NextResponse.json(loans);
  }

  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const loans = await listReturnLoans({ borrower, includeReturned });
  return NextResponse.json(loans);
}
