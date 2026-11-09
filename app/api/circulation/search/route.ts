import { NextResponse } from "next/server";
import { currentBorrower } from "@/lib/access";
import { searchCatalogue } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await searchCatalogue(query, borrower));
}
