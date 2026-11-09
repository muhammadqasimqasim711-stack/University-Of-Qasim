import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { findLoanByBarcode, listLoanBarcodes } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const trimmed = code.trim();
    if (!trimmed) {
      return NextResponse.json(
        { message: "Please provide a barcode to search." },
        { status: 400 },
      );
    }
    const loan = await findLoanByBarcode(trimmed);
    if (!loan) {
      return NextResponse.json(
        { message: `No borrower or issue record found for barcode "${trimmed}".` },
        { status: 404 },
      );
    }
    return NextResponse.json(loan);
  }

  const typeParam = url.searchParams.get("type");
  const filterType =
    typeParam === "student"
      ? "student"
      : typeParam === "teacher"
      ? "teacher"
      : "all";

  const barcodes = await listLoanBarcodes(filterType);
  return NextResponse.json(barcodes);
}
