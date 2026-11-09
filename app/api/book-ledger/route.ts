import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { issuedCopyCounts, remainingCopies } from "@/lib/circulation";
import { signInRequired } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const [{ totalCopies, issuedByBookId }, rows] = await Promise.all([
    issuedCopyCounts(),
    prisma.book.findMany({
    where: query
      ? {
          OR: [
            { bookName: { contains: query } },
            { subName: { contains: query } },
            { authorName: { contains: query } },
            { publisher: { contains: query } },
            { edition: { contains: query } },
            { category: { contains: query } },
            { shelf: { contains: query } },
            { barcode: { contains: query } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      imagePath: true,
      bookName: true,
      subName: true,
      authorName: true,
      publisher: true,
      edition: true,
      category: true,
      shelf: true,
      barcode: true,
      bookInformation: true,
    },
  }),
  ]);

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      imagePath: row.imagePath,
      bookName: row.bookName,
      subName: row.subName,
      authorName: row.authorName,
      publisher: row.publisher,
      edition: row.edition,
      category: row.category,
      shelf: row.shelf,
      barcode: row.barcode,
      bookInformation: row.bookInformation,
      availableCopies: remainingCopies(totalCopies, issuedByBookId.get(row.id) ?? 0),
    })),
  );
}
