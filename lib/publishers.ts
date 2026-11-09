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

export const publisherInputSchema = z.object({
  name: requiredText("Publisher name", 120),
  address: optionalText("Address", 200).default(""),
  contact: optionalText("Contact / Phone", 80).default(""),
  email: z
    .string()
    .trim()
    .max(120, "Email must be 120 characters or fewer.")
    .refine((val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Enter a valid email address.",
    })
    .default(""),
});

export type PublisherInput = z.infer<typeof publisherInputSchema>;

export type PublisherFieldErrors = Partial<Record<keyof PublisherInput, string[]>>;

type PublisherRow = {
  id: number;
  name: string;
  address: string;
  contact: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PublisherView = {
  id: number;
  name: string;
  address: string;
  contact: string;
  email: string;
  booksCount: number;
  createdAt: string;
  updatedAt: string;
};

export function toPublisherView(row: PublisherRow, booksCount = 0): PublisherView {
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
    name: row.name,
    address: row.address,
    contact: row.contact,
    email: row.email,
    booksCount,
    createdAt,
    updatedAt,
  };
}

export async function listPublishers(query = ""): Promise<PublisherView[]> {
  // Sync publishers from any existing books first so legacy/current books' publishers appear
  await syncPublishersFromBooks().catch(() => {});

  const needle = query.trim();
  const where: Prisma.PublisherWhereInput | undefined = needle
    ? {
        OR: [
          { name: { contains: needle } },
          { address: { contains: needle } },
          { contact: { contains: needle } },
          { email: { contains: needle } },
        ],
      }
    : undefined;

  const [rows, allBooks] = await Promise.all([
    prisma.publisher.findMany({
      where,
      orderBy: { name: "asc" },
    }),
    prisma.book.findMany({
      select: { publisher: true },
    }),
  ]);

  const countByPublisher = new Map<string, number>();
  for (const book of allBooks) {
    const key = book.publisher.trim().toLowerCase();
    countByPublisher.set(key, (countByPublisher.get(key) ?? 0) + 1);
  }

  return rows.map((row) =>
    toPublisherView(
      row,
      countByPublisher.get(row.name.trim().toLowerCase()) ?? 0,
    ),
  );
}

export async function getPublisher(id: number): Promise<PublisherView | null> {
  const row = await prisma.publisher.findUnique({ where: { id } });
  if (!row) return null;

  const booksCount = await prisma.book.count({
    where: { publisher: row.name },
  });

  return toPublisherView(row, booksCount);
}

export async function createPublisher(input: PublisherInput) {
  const name = input.name.trim();
  const row = await prisma.publisher.create({
    data: {
      name,
      address: input.address.trim(),
      contact: input.contact.trim(),
      email: input.email.trim().toLowerCase(),
    },
  });

  const booksCount = await prisma.book.count({
    where: { publisher: row.name },
  });

  return { publisher: toPublisherView(row, booksCount) };
}

export async function updatePublisher(id: number, input: PublisherInput) {
  try {
    const existing = await prisma.publisher.findUnique({ where: { id } });
    if (!existing) {
      return { missing: true as const };
    }

    const newName = input.name.trim();
    const oldName = existing.name;

    const row = await prisma.publisher.update({
      where: { id },
      data: {
        name: newName,
        address: input.address.trim(),
        contact: input.contact.trim(),
        email: input.email.trim().toLowerCase(),
      },
    });

    // If the publisher name was changed, sync all books with the old name
    if (oldName !== newName) {
      await prisma.book.updateMany({
        where: { publisher: oldName },
        data: { publisher: newName },
      });
    }

    const booksCount = await prisma.book.count({
      where: { publisher: row.name },
    });

    return { publisher: toPublisherView(row, booksCount) };
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

export async function deletePublisher(id: number) {
  try {
    await prisma.publisher.delete({ where: { id } });
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

/**
 * Ensures any distinct publishers currently stored on Books exist in the Publisher table.
 */
let syncedOnce = false;
export async function syncPublishersFromBooks() {
  if (syncedOnce) return;
  syncedOnce = true;

  try {
    const books = await prisma.book.findMany({
      select: { publisher: true },
      distinct: ["publisher"],
    });

    for (const b of books) {
      const pubName = b.publisher?.trim();
      if (!pubName) continue;
      const exists = await prisma.publisher.findUnique({
        where: { name: pubName },
      });
      if (!exists) {
        await prisma.publisher.create({
          data: { name: pubName },
        }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}
