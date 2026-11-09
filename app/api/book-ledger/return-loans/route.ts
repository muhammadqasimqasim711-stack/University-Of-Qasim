import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { listReturnLoans } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "student" || kindParam === "teacher" ? kindParam : undefined;

  const statusParam = url.searchParams.get("status"); // "active" | "returned" | "overdue" | "all"
  const onlyOverdue = statusParam === "overdue";
  const onlyReturned = statusParam === "returned";
  const includeReturned = statusParam === "all" || onlyReturned;

  const loans = await listReturnLoans({
    kind,
    onlyOverdue,
    onlyReturned,
    includeReturned,
  });

  return NextResponse.json(loans);
}
