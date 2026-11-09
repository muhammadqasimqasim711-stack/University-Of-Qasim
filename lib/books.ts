import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  CONFIGURATION_ID,
  DEFAULT_BARCODE_START,
  DEFAULT_BARCODE_END,
} from "@/lib/defaults";
import { parseBarcodePattern } from "@/lib/configuration";

const requiredText = (label: string, max: number) =>
  z
    .string(`${label} is required.`)
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);

export { BOOK_CATEGORIES, type BookCategory } from "@/lib/book-categories";

export const bookInputSchema = z.object({
  authorName: requiredText("Author name", 120),
  publisher: requiredText("Publisher", 120),
  edition: requiredText("Edition", 40),
  category: requiredText("Category", 80),
  bookName: requiredText("Book name", 200),
  subName: optionalText("Sub name", 200),
  shelf: requiredText("Shelf", 40),
  barcode: optionalText("Barcode", 40),
  bookInformation: optionalText("Book information", 2000),
});

export type BookInput = z.infer<typeof bookInputSchema>;

export type BookFieldErrors = Partial<
  Record<keyof BookInput | "image", string[]>
>;

export type BookView = {
  id: number;
  authorName: string;
  publisher: string;
  edition: string;
  category: string;
  bookName: string;
  subName: string;
  shelf: string;
  barcode: string;
  bookInformation: string;
  imagePath: string;
};

export const MAX_COVER_BYTES = 2 * 1024 * 1024;

type BookRow = {
  id: number;
  authorName: string;
  publisher: string;
  edition: string;
  category: string;
  bookName: string;
  subName: string;
  shelf: string;
  barcode: string;
  bookInformation: string;
  imagePath: string;
};

function toView(book: BookRow): BookView {
  return {
    id: book.id,
    authorName: book.authorName,
    publisher: book.publisher,
    edition: book.edition,
    category: book.category,
    bookName: book.bookName,
    subName: book.subName,
    shelf: book.shelf,
    barcode: book.barcode,
    bookInformation: book.bookInformation,
    imagePath: book.imagePath,
  };
}

export function detectCoverExtension(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export async function readCover(image: FormDataEntryValue | null): Promise<
  | { missing: true }
  | { error: string }
  | { bytes: Uint8Array; extension: "jpg" | "png" | "webp" }
> {
  if (!(image instanceof File) || image.size === 0) {
    return { missing: true };
  }

  if (image.size > MAX_COVER_BYTES) {
    return { error: "The book image must be 2 MB or smaller." };
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  const extension = detectCoverExtension(bytes);
  if (!extension) {
    return { error: "The book image must be a JPEG, PNG, or WebP file." };
  }

  return { bytes, extension };
}

export async function saveCover(
  bytes: Uint8Array,
  extension: "jpg" | "png" | "webp",
) {
  const directory = path.join(process.cwd(), "public", "book-images");
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, filename), bytes);
  return `/book-images/${filename}`;
}

export async function removeCover(imagePath: string) {
  if (!imagePath.startsWith("/book-images/")) {
    return;
  }

  const filename = path.basename(imagePath);
  await unlink(path.join(process.cwd(), "public", "book-images", filename)).catch(
    () => undefined,
  );
}

export type NextBarcodeResult =
  | {
      success: true;
      barcode: string;
      currentRange: { start: string; end: string };
      allocatedCount: number;
      totalCapacity: number;
    }
  | {
      success: false;
      error: string;
      currentRange: { start: string; end: string };
      allocatedCount: number;
      totalCapacity: number;
    };

export async function getNextBookBarcode(): Promise<NextBarcodeResult> {
  const config = await prisma.masterConfiguration.findUnique({
    where: { id: CONFIGURATION_ID },
  });

  const start = config?.barcodeStart || DEFAULT_BARCODE_START;
  const end = config?.barcodeEnd || DEFAULT_BARCODE_END;

  const startParsed = parseBarcodePattern(start);
  const endParsed = parseBarcodePattern(end);

  if (!startParsed || !endParsed) {
    return {
      success: false,
      error: "Master Configuration barcode range is invalid. Please check System Configuration.",
      currentRange: { start, end },
      allocatedCount: 0,
      totalCapacity: 0,
    };
  }

  const prefix = startParsed.prefix;
  const startNum = startParsed.number;
  const endNum = endParsed.number;
  const padLength = startParsed.padLength;
  const totalCapacity = Math.max(0, endNum - startNum + 1);

  const existingBooks = await prisma.book.findMany({
    select: { barcode: true },
  });

  let maxNum = 0;
  const usedNumbers = new Set<number>();

  for (const b of existingBooks) {
    const parsed = parseBarcodePattern(b.barcode);
    if (parsed && parsed.prefix === prefix) {
      usedNumbers.add(parsed.number);
      if (parsed.number > maxNum) {
        maxNum = parsed.number;
      }
    }
  }

  let candidateNum = maxNum >= startNum ? maxNum + 1 : startNum;

  while (usedNumbers.has(candidateNum)) {
    candidateNum++;
  }

  const allocatedCount = usedNumbers.size;

  if (candidateNum > endNum) {
    return {
      success: false,
      error: `Cannot add book: Barcode range ended at ${end}. Please go to Master Configuration and update the "Barcode ends" field (e.g. to ${prefix}${candidateNum + 99}) to add more books.`,
      currentRange: { start, end },
      allocatedCount,
      totalCapacity,
    };
  }

  const barcode = `${prefix}${String(candidateNum).padStart(padLength, "0")}`;
  return {
    success: true,
    barcode,
    currentRange: { start, end },
    allocatedCount,
    totalCapacity,
  };
}

export async function createBook(
  input: BookInput,
  imagePath: string,
): Promise<{ book: BookView } | { errors: BookFieldErrors; message?: string }> {
  let assignedBarcode = input.barcode?.trim();

  if (!assignedBarcode) {
    const barcodeResult = await getNextBookBarcode();
    if (!barcodeResult.success) {
      return {
        errors: { barcode: [barcodeResult.error] },
        message: barcodeResult.error,
      };
    }
    assignedBarcode = barcodeResult.barcode;
  }

  try {
    const book = await prisma.book.create({
      data: {
        authorName: input.authorName,
        publisher: input.publisher,
        edition: input.edition,
        category: input.category,
        bookName: input.bookName,
        subName: input.subName,
        shelf: input.shelf,
        barcode: assignedBarcode,
        bookInformation: input.bookInformation,
        imagePath,
      },
    });
    return { book: toView(book) };
  } catch (error) {
    const errors = uniqueFieldErrors(error);
    if (errors) {
      return { errors };
    }
    throw error;
  }
}

function bookData(input: BookInput) {
  return {
    authorName: input.authorName,
    publisher: input.publisher,
    edition: input.edition,
    category: input.category,
    bookName: input.bookName,
    subName: input.subName,
    shelf: input.shelf,
    barcode: input.barcode,
    bookInformation: input.bookInformation,
  };
}

export type BookFilterOptions = {
  query?: string;
  category?: string;
  authorName?: string;
  publisher?: string;
  shelf?: string;
  barcode?: string;
};

export async function listBooks(
  options: string | BookFilterOptions = "",
  legacyCategory = "",
) {
  const opts: BookFilterOptions =
    typeof options === "string"
      ? { query: options, category: legacyCategory }
      : options;

  const needle = (opts.query ?? "").trim();
  const normalizedCategory = (opts.category ?? "").trim();
  const andClauses: Prisma.BookWhereInput[] = [];

  if (normalizedCategory && normalizedCategory.toLowerCase() !== "all") {
    andClauses.push({ category: { equals: normalizedCategory } });
  }

  if (opts.authorName?.trim()) {
    andClauses.push({ authorName: { contains: opts.authorName.trim() } });
  }

  if (opts.publisher?.trim()) {
    andClauses.push({ publisher: { contains: opts.publisher.trim() } });
  }

  if (opts.shelf?.trim()) {
    andClauses.push({ shelf: { contains: opts.shelf.trim() } });
  }

  if (opts.barcode?.trim()) {
    andClauses.push({ barcode: { contains: opts.barcode.trim() } });
  }

  if (needle) {
    andClauses.push({
      OR: [
        { bookName: { contains: needle } },
        { subName: { contains: needle } },
        { authorName: { contains: needle } },
        { publisher: { contains: needle } },
        { edition: { contains: needle } },
        { shelf: { contains: needle } },
        { barcode: { contains: needle } },
        { category: { contains: needle } },
      ],
    });
  }

  const where: Prisma.BookWhereInput | undefined =
    andClauses.length > 0 ? { AND: andClauses } : undefined;

  const rows = await prisma.book.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map(toView);
}

export async function getBook(id: number) {
  const row = await prisma.book.findUnique({ where: { id } });
  return row ? toView(row) : null;
}

export async function findBookByBarcode(code: string) {
  const row = await prisma.book.findUnique({ where: { barcode: code } });
  return row ? toView(row) : null;
}

export async function updateBook(
  id: number,
  input: BookInput,
  imagePath?: string,
): Promise<{ book: BookView } | { missing: true } | { errors: BookFieldErrors }> {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return { missing: true };
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...bookData(input),
        ...(imagePath ? { imagePath } : {}),
      },
    });
    if (imagePath && imagePath !== existing.imagePath) {
      await removeCover(existing.imagePath);
    }
    return { book: toView(book) };
  } catch (error) {
    const errors = uniqueFieldErrors(error);
    if (errors) {
      return { errors };
    }
    throw error;
  }
}

export async function deleteBook(
  id: number,
): Promise<{ deleted: true } | { missing: true }> {
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return { missing: true };
  }

  await prisma.book.delete({ where: { id } });
  await removeCover(existing.imagePath);
  return { deleted: true };
}

function uniqueFieldErrors(error: unknown): BookFieldErrors | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  return { barcode: ["This barcode is already in use."] };
}
