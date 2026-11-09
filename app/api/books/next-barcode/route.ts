import { NextResponse } from "next/server";
import { getNextBookBarcode } from "@/lib/books";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getNextBookBarcode();
  return NextResponse.json(result);
}
