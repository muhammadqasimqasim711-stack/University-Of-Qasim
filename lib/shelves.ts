import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const requiredText = (label: string, max: number) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`);

export const shelfInputSchema = z.object({
  shelfNumber: requiredText("Shelf number", 40),
  location: optionalText("Location", 120).default(""),
  category: optionalText("Category", 80).default(""),
  capacity: z
    .union([z.number().int().positive(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return Number.isNaN(num) || num <= 0 ? null : Math.floor(num);
    })
    .default(null),
  description: optionalText("Description", 1000).default(""),
});

export type ShelfInput = z.infer<typeof shelfInputSchema>;

export type ShelfFieldErrors = Partial<Record<keyof ShelfInput, string[]>>;

type ShelfRow = {
  id: number;
  shelfNumber: string;
  location: string;
  category: string;
  capacity: number | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ShelfView = {
  id: number;
  shelfNumber: string;
  location: string;
  category: string;
  capacity: number | null;
  description: string;
  booksCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ShelfBookSummary = {
  id: number;
  bookName: string;
  authorName: string;
  category: string;
  edition: string;
  barcode: string;
  imagePath: string;
};

export type ShelfDetailView = ShelfView & {
  books: ShelfBookSummary[];
};

export function toShelfView(row: ShelfRow, booksCount = 0): ShelfView {
  const createdAt =
    row.createdAt instanceof Date
      ? (!Number.isNaN(row.createdAt.getTime()) ? row.createdAt.toISOString() : "")
      : row.createdAt
        ? String(row.createdAt)
        : "";
  const updatedAt =
    row.updatedAt instanceof Date
      ? (!Number.isNaN(row.updatedAt.getTime()) ? row.updatedAt.toISOString() : "")
      : row.updatedAt
        ? String(row.updatedAt)
        : "";

  return {
    id: row.id,
    shelfNumber: row.shelfNumber,
    location: row.location,
    category: row.category,
    capacity: row.capacity,
    description: row.description,
    booksCount,
    createdAt,
    updatedAt,
  };
}

export async function listShelves(query = ""): Promise<ShelfView[]> {
  const needle = query.trim();
  const where: Prisma.ShelfWhereInput | undefined = needle
    ? {
        OR: [
          { shelfNumber: { contains: needle } },
          { location: { contains: needle } },
          { category: { contains: needle } },
          { description: { contains: needle } },
        ],
      }
    : undefined;

  const rows = await prisma.shelf.findMany({
    where,
    orderBy: [{ shelfNumber: "asc" }, { id: "asc" }],
  });

  const books = await prisma.book.findMany({
    select: { shelf: true },
  });

  const countMap = new Map<string, number>();
  for (const book of books) {
    const key = book.shelf.trim().toLowerCase();
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    const count = countMap.get(row.shelfNumber.trim().toLowerCase()) ?? 0;
    return toShelfView(row, count);
  });
}

export async function getShelf(id: number): Promise<ShelfDetailView | null> {
  const row = await prisma.shelf.findUnique({ where: { id } });
  if (!row) {
    return null;
  }

  const books = await prisma.book.findMany({
    where: {
      shelf: {
        equals: row.shelfNumber,
      },
    },
    select: {
      id: true,
      bookName: true,
      authorName: true,
      category: true,
      edition: true,
      barcode: true,
      imagePath: true,
    },
    orderBy: { bookName: "asc" },
  });

  const view = toShelfView(row, books.length);
  return {
    ...view,
    books,
  };
}

export async function createShelf(input: ShelfInput) {
  try {
    const row = await prisma.shelf.create({
      data: {
        shelfNumber: input.shelfNumber.trim(),
        location: input.location.trim(),
        category: input.category.trim(),
        capacity: input.capacity,
        description: input.description.trim(),
      },
    });
    return { shelf: toShelfView(row, 0) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        errors: { shelfNumber: ["A shelf with this number/name already exists."] },
      };
    }
    throw error;
  }
}

export async function updateShelf(id: number, input: ShelfInput) {
  try {
    const existing = await prisma.shelf.findUnique({ where: { id } });
    if (!existing) {
      return { missing: true as const };
    }

    const row = await prisma.shelf.update({
      where: { id },
      data: {
        shelfNumber: input.shelfNumber.trim(),
        location: input.location.trim(),
        category: input.category.trim(),
        capacity: input.capacity,
        description: input.description.trim(),
      },
    });

    // If shelf number was changed, update all books with previous shelf
    if (existing.shelfNumber !== row.shelfNumber) {
      await prisma.book.updateMany({
        where: { shelf: existing.shelfNumber },
        data: { shelf: row.shelfNumber },
      });
    }

    const bookCount = await prisma.book.count({
      where: { shelf: { equals: row.shelfNumber } },
    });

    return { shelf: toShelfView(row, bookCount) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        errors: { shelfNumber: ["A shelf with this number/name already exists."] },
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { missing: true as const };
    }
    throw error;
  }
}

export async function deleteShelf(id: number) {
  try {
    await prisma.shelf.delete({ where: { id } });
    return { deleted: true as const };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { missing: true as const };
    }
    throw error;
  }
}
