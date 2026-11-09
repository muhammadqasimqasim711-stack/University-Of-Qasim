import { NextResponse } from "next/server";
import { findBookByBarcode } from "@/lib/books";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json(
      { message: "Enter a barcode." },
      { status: 400 },
    );
  }

  const book = await findBookByBarcode(code);
  if (!book) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  return NextResponse.json(book);
}
