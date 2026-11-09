import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  bookInputSchema,
  deleteBook,
  getBook,
  readCover,
  removeCover,
  saveCover,
  updateBook,
  type BookFieldErrors,
} from "@/lib/books";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Book not found." }, { status: 404 });
}

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function textValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const book = await getBook(id);
  if (!book) {
    return invalidId();
  }

  return NextResponse.json(book);
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const existingBook = await getBook(id);
  if (!existingBook) {
    return invalidId();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Request body must be form data." },
      { status: 400 },
    );
  }

  const barcodeFromForm = textValue(form.get("barcode")).trim();
  const barcodeToUse = barcodeFromForm || existingBook.barcode;

  const parsed = bookInputSchema.safeParse({
    authorName: textValue(form.get("authorName")),
    publisher: textValue(form.get("publisher")),
    edition: textValue(form.get("edition")),
    category: textValue(form.get("category")),
    bookName: textValue(form.get("bookName")),
    subName: textValue(form.get("subName")),
    shelf: textValue(form.get("shelf")),
    barcode: barcodeToUse,
    bookInformation: textValue(form.get("bookInformation")),
  });

  const errors: BookFieldErrors = {};
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    Object.assign(errors, flattened.fieldErrors);
  }

  const cover = await readCover(form.get("image"));
  if ("error" in cover) {
    errors.image = [cover.error];
  }

  if (!parsed.success || "error" in cover) {
    return NextResponse.json(
      {
        message:
          Object.values(errors)[0]?.[0] ?? "The book record is not valid.",
        errors,
      },
      { status: 400 },
    );
  }

  let imagePath: string | undefined;
  if ("bytes" in cover) {
    imagePath = await saveCover(cover.bytes, cover.extension);
  }

  try {
    const result = await updateBook(id, parsed.data, imagePath);
    if ("missing" in result) {
      if (imagePath) {
        await removeCover(imagePath);
      }
      return invalidId();
    }
    if ("errors" in result) {
      if (imagePath) {
        await removeCover(imagePath);
      }
      return NextResponse.json(
        {
          message: "The book record is not valid.",
          errors: result.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result.book);
  } catch {
    if (imagePath) {
      await removeCover(imagePath);
    }
    return NextResponse.json(
      { message: "Could not save the book." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deleteBook(id);
  if ("missing" in result) {
    return invalidId();
  }

  return new NextResponse(null, { status: 204 });
}
