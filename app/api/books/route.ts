import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  MAX_COVER_BYTES,
  bookInputSchema,
  createBook,
  getNextBookBarcode,
  detectCoverExtension,
  listBooks,
  removeCover,
  saveCover,
  type BookFieldErrors,
} from "@/lib/books";
import { issuedCopyCounts, remainingCopies } from "@/lib/circulation";

export const dynamic = "force-dynamic";

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? undefined;
  const authorName = url.searchParams.get("author") ?? undefined;
  const publisher = url.searchParams.get("publisher") ?? undefined;
  const shelf = url.searchParams.get("shelf") ?? undefined;
  const barcode = url.searchParams.get("barcode") ?? undefined;

  const [{ totalCopies, issuedByBookId }, books] = await Promise.all([
    issuedCopyCounts(),
    listBooks({
      query,
      category,
      authorName,
      publisher,
      shelf,
      barcode,
    }),
  ]);
  return NextResponse.json(
    books.map((book) => ({
      ...book,
      availableCopies: remainingCopies(
        totalCopies,
        issuedByBookId.get(book.id) ?? 0,
      ),
    })),
  );
}

export async function POST(request: Request) {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Request body must be form data." },
      { status: 400 },
    );
  }

  const parsed = bookInputSchema.safeParse({
    authorName: textValue(form.get("authorName")),
    publisher: textValue(form.get("publisher")),
    edition: textValue(form.get("edition")),
    category: textValue(form.get("category")),
    bookName: textValue(form.get("bookName")),
    subName: textValue(form.get("subName")),
    shelf: textValue(form.get("shelf")),
    barcode: textValue(form.get("barcode")),
    bookInformation: textValue(form.get("bookInformation")),
  });

  const errors: BookFieldErrors = {};
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    Object.assign(errors, flattened.fieldErrors);
  }

  const providedBarcode = textValue(form.get("barcode")).trim();
  if (!providedBarcode) {
    const barcodeCheck = await getNextBookBarcode();
    if (!barcodeCheck.success) {
      errors.barcode = [barcodeCheck.error];
    }
  }

  const image = form.get("image");
  let coverBytes: Uint8Array | null = null;
  let extension: "jpg" | "png" | "webp" | null = null;

  if (!(image instanceof File) || image.size === 0) {
    errors.image = ["A book image is required."];
  } else if (image.size > MAX_COVER_BYTES) {
    errors.image = ["The book image must be 2 MB or smaller."];
  } else {
    coverBytes = new Uint8Array(await image.arrayBuffer());
    extension = detectCoverExtension(coverBytes);
    if (!extension) {
      errors.image = ["The book image must be a JPEG, PNG, or WebP file."];
    }
  }

  if (!parsed.success || !coverBytes || !extension || errors.image || errors.barcode) {
    return NextResponse.json(
      {
        message:
          errors.barcode?.[0] ??
          Object.values(errors)[0]?.[0] ??
          "The book record is not valid.",
        errors,
      },
      { status: 400 },
    );
  }

  const imagePath = await saveCover(coverBytes, extension);

  try {
    const result = await createBook(parsed.data, imagePath);
    if ("errors" in result) {
      await removeCover(imagePath);
      return NextResponse.json(
        {
          message:
            result.message ??
            Object.values(result.errors)[0]?.[0] ??
            "The book record is not valid.",
          errors: result.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result.book, { status: 201 });
  } catch {
    await removeCover(imagePath);
    return NextResponse.json(
      { message: "Could not save the book." },
      { status: 500 },
    );
  }
}
