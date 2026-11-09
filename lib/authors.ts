import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

export const authorInputSchema = z.object({
  fullName: requiredText("Full name", 120),
  biography: optionalText("Biography", 2000).default(""),
  email: z
    .string()
    .trim()
    .max(120, "Email must be 120 characters or fewer.")
    .refine((val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Enter a valid email address.",
    })
    .default(""),
  nationality: optionalText("Nationality", 80).default(""),
});

export type AuthorInput = z.infer<typeof authorInputSchema>;

export type AuthorFieldErrors = Partial<Record<keyof AuthorInput, string[]>>;

type AuthorRow = {
  id: number;
  fullName: string;
  biography: string;
  email: string;
  nationality: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthorView = {
  id: number;
  fullName: string;
  biography: string;
  email: string;
  nationality: string;
  booksCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthorBookSummary = {
  id: number;
  bookName: string;
  category: string;
  edition: string;
  shelf: string;
  barcode: string;
  imagePath: string;
  quantity: number;
};

export type AuthorDetailView = AuthorView & {
  books: AuthorBookSummary[];
};

export function toAuthorView(row: AuthorRow, booksCount = 0): AuthorView {
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
    fullName: row.fullName,
    biography: row.biography,
    email: row.email,
    nationality: row.nationality,
    booksCount,
    createdAt,
    updatedAt,
  };
}

export async function listAuthors(query = ""): Promise<AuthorView[]> {
  const needle = query.trim();
  const where: Prisma.AuthorWhereInput | undefined = needle
    ? {
        OR: [
          { fullName: { contains: needle } },
          { nationality: { contains: needle } },
          { email: { contains: needle } },
          { biography: { contains: needle } },
        ],
      }
    : undefined;

  const rows = await prisma.author.findMany({
    where,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  const books = await prisma.book.findMany({
    select: { authorName: true },
  });

  return rows.map((row) => {
    const target = row.fullName.trim().toLowerCase();
    const count = books.filter((b) => {
      const bookAuthor = b.authorName.trim().toLowerCase();
      return (
        bookAuthor === target ||
        bookAuthor.includes(target) ||
        target.includes(bookAuthor)
      );
    }).length;
    return toAuthorView(row, count);
  });
}

export async function getAuthor(id: number): Promise<AuthorDetailView | null> {
  const row = await prisma.author.findUnique({ where: { id } });
  if (!row) {
    return null;
  }

  const allBooks = await prisma.book.findMany({
    orderBy: { bookName: "asc" },
  });

  const targetName = row.fullName.trim().toLowerCase();
  const matchedBooks = allBooks.filter((book) => {
    const bookAuthor = book.authorName.trim().toLowerCase();
    return (
      bookAuthor === targetName ||
      bookAuthor.includes(targetName) ||
      targetName.includes(bookAuthor)
    );
  });

  const titleCountMap = new Map<string, number>();
  for (const book of matchedBooks) {
    const key = book.bookName.trim().toLowerCase();
    titleCountMap.set(key, (titleCountMap.get(key) ?? 0) + 1);
  }

  const books: AuthorBookSummary[] = matchedBooks.map((book) => ({
    id: book.id,
    bookName: book.bookName,
    category: book.category,
    edition: book.edition,
    shelf: book.shelf,
    barcode: book.barcode,
    imagePath: book.imagePath,
    quantity: titleCountMap.get(book.bookName.trim().toLowerCase()) ?? 1,
  }));

  const view = toAuthorView(row, matchedBooks.length);
  return {
    ...view,
    books,
  };
}

export async function createAuthor(input: AuthorInput) {
  const row = await prisma.author.create({
    data: {
      fullName: input.fullName.trim(),
      biography: input.biography.trim(),
      email: input.email.trim().toLowerCase(),
      nationality: input.nationality.trim(),
    },
  });
  return { author: toAuthorView(row, 0) };
}

export async function updateAuthor(id: number, input: AuthorInput) {
  try {
    const existing = await prisma.author.findUnique({ where: { id } });
    if (!existing) {
      return { missing: true as const };
    }

    const oldName = existing.fullName;
    const newName = input.fullName.trim();

    const row = await prisma.author.update({
      where: { id },
      data: {
        fullName: newName,
        biography: input.biography.trim(),
        email: input.email.trim().toLowerCase(),
        nationality: input.nationality.trim(),
      },
    });

    if (oldName !== newName) {
      await prisma.book.updateMany({
        where: { authorName: oldName },
        data: { authorName: newName },
      });
    }

    const allBooks = await prisma.book.findMany({
      select: { authorName: true },
    });
    const target = row.fullName.trim().toLowerCase();
    const bookCount = allBooks.filter((b) => {
      const bookAuthor = b.authorName.trim().toLowerCase();
      return (
        bookAuthor === target ||
        bookAuthor.includes(target) ||
        target.includes(bookAuthor)
      );
    }).length;

    return { author: toAuthorView(row, bookCount) };
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

export async function deleteAuthor(id: number) {
  try {
    await prisma.author.delete({ where: { id } });
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
