import { NextResponse } from "next/server";
import { currentBorrower } from "@/lib/access";
import { borrowerWhere } from "@/lib/borrower";
import { listNotifications } from "@/lib/circulation";
import { utcDateToIsoDate } from "@/lib/dates";
import { signInRequired } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const [loans, notifications] = await Promise.all([
    prisma.loan.findMany({
      where: {
        ...borrowerWhere(borrower),
        status: { not: "DECLINED" },
      },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        issueDate: true,
        dueDate: true,
        returnedAt: true,
        adminApprovedAt: true,
        book: {
          select: {
            bookName: true,
            authorName: true,
            publisher: true,
            category: true,
            shelf: true,
            barcode: true,
          },
        },
      },
    }),
    listNotifications(borrower),
  ]);

  const rows = loans.map((loan) => ({
    id: loan.id,
    bookName: loan.book.bookName,
    authorName: loan.book.authorName,
    publisher: loan.book.publisher,
    category: loan.book.category,
    shelf: loan.book.shelf,
    barcode: loan.book.barcode,
    issueDate: utcDateToIsoDate(loan.issueDate),
    dueDate: utcDateToIsoDate(loan.dueDate),
    returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
    approved: Boolean(loan.adminApprovedAt),
  }));

  return NextResponse.json({
    borrowed: rows.filter((row) => !row.returnedAt),
    returned: rows.filter((row) => row.returnedAt),
    approvalNotes: notifications
      .filter(
        (note) =>
          !note.readAt && note.message.toLowerCase().includes("was approved"),
      )
      .map((note) => ({ id: note.id, message: note.message })),
  });
}
