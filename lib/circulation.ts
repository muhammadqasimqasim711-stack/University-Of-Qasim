import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { BorrowerRef } from "@/lib/borrower";
import { borrowerData, borrowerWhere, sameBorrower } from "@/lib/borrower";
import { listBooks } from "@/lib/books";
import {
  borrowingDates,
  calendarDateInKarachi,
  formatDisplayDate,
  isoDateToUtcDate,
  utcDateToIsoDate,
} from "@/lib/dates";
import { getStudent } from "@/lib/students";
import { getTeacher } from "@/lib/teachers";
import { prisma } from "@/lib/prisma";

const openReservation = ["WAITING", "READY"] as const;

export class CirculationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MONTHLY_BORROW_LIMIT = 5;
export const TOTAL_BOOK_COPIES = 10;

export function formatCopyCode(copyNumber: number): string {
  return `BOOK-${String(copyNumber).padStart(2, "0")}`;
}

type CirculationConfig = {
  libraryName: string;
  contactEmail: string;
  borrowingPeriodDays: number;
  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  monthlyBorrowLimit: number;
  defaultCopiesPerBook: number;
};

let cachedCirculationConfig: { data: CirculationConfig; expiresAt: number } | null = null;

export function invalidateCirculationConfigCache() {
  cachedCirculationConfig = null;
}

export async function getCirculationConfig(tx?: Prisma.TransactionClient): Promise<CirculationConfig> {
  const now = Date.now();
  if (!tx && cachedCirculationConfig && cachedCirculationConfig.expiresAt > now) {
    return cachedCirculationConfig.data;
  }

  const client = tx ?? prisma;
  const config = await client.masterConfiguration.findUnique({ where: { id: 1 } });
  const data: CirculationConfig = {
    libraryName: config?.libraryName ?? "University of Qasim",
    contactEmail: config?.contactEmail ?? "library@uoq.edu.pk",
    borrowingPeriodDays: config?.borrowingPeriodDays ?? 14,
    maxBooksPerStudent: config?.maxBooksPerStudent ?? 3,
    maxBooksPerTeacher: config?.maxBooksPerTeacher ?? 5,
    monthlyBorrowLimit: config?.monthlyBorrowLimit ?? 5,
    defaultCopiesPerBook: config?.defaultCopiesPerBook ?? 10,
  };

  if (!tx) {
    cachedCirculationConfig = { data, expiresAt: now + 60_000 };
  }

  return data;
}

export function getStartOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
}

export async function issuedCopyCounts(): Promise<{
  totalCopies: number;
  issuedByBookId: Map<number, number>;
}> {
  const config = await getCirculationConfig();
  const openLoans = await prisma.loan.findMany({
    where: { returnedAt: null, status: { not: "DECLINED" } },
    select: { bookId: true },
  });
  const issuedByBookId = new Map<number, number>();
  for (const loan of openLoans) {
    issuedByBookId.set(loan.bookId, (issuedByBookId.get(loan.bookId) ?? 0) + 1);
  }
  return { totalCopies: config.defaultCopiesPerBook, issuedByBookId };
}

export function remainingCopies(totalCopies: number, issued: number) {
  return Math.max(0, totalCopies - issued);
}

export type BookCopyStatus = {
  copyNumber: number;
  copyCode: string; // e.g. "BOOK-01" to "BOOK-10"
  isBorrowed: boolean;
  loanId?: number;
  borrowerName?: string;
  borrowerKind?: "student" | "teacher";
  identifier?: string;
  department?: string;
  issueDate?: string;
  dueDate?: string;
  overdue?: boolean;
  status?: string;
  returnAllowed?: boolean;
};

export type ActiveBorrowerDetail = {
  loanId: number;
  copyNumber: number;
  copyCode: string;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
  identifier: string;
  department: string;
  issueDate: string;
  dueDate: string;
  overdue: boolean;
  status: string;
  borrowerAcceptedAt: string | null;
  adminApprovedAt: string | null;
  returnAllowed: boolean;
  returnAllowedAt: string | null;
};

export type TotalBookSummary = {
  id: number;
  bookName: string;
  authorName: string;
  category: string;
  edition: string;
  shelf: string;
  barcode: string;
  imagePath: string;
  totalCopies: number;
  borrowedCopies: number;
  availableCopies: number;
  isAvailable: boolean;
  activeBorrowers: ActiveBorrowerDetail[];
  copies: BookCopyStatus[];
};

export type BorrowerLoanRecord = {
  id: number;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  bookName: string;
  barcode: string;
  shelf: string;
  issueDate: string;
  dueDate: string;
  status: string;
  borrowerAcceptedAt: string | null;
  adminApprovedAt: string | null;
  returnedAt: string | null;
  overdue: boolean;
  returnAllowed: boolean;
  returnAllowedAt: string | null;
};

export type BorrowerBorrowSummary = {
  id: number;
  fullName: string;
  identifier: string;
  department: string;
  designation?: string;
  email: string;
  status: string;
  monthCount: number;
  maxMonthLimit: number;
  canBorrow: boolean;
  activeLoansCount: number;
  loans: BorrowerLoanRecord[];
};

export type LoanView = {
  id: number;
  loanBarcode?: string;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  studentId?: number | null;
  teacherId?: number | null;
  bookName: string;
  authorName?: string;
  category?: string;
  shelf?: string;
  barcode?: string;
  publisher?: string;
  imagePath?: string;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
  status: string;
  borrowerAcceptedAt: string | null;
  adminApprovedAt: string | null;
  issueDate: string;
  dueDate: string;
  overdue: boolean;
  returnAllowed: boolean;
  returnAllowedAt: string | null;
};

export type BarcodeLoanItem = {
  loanId: number;
  barcode: string;
  copyNumber: number;
  copyCode: string;
  borrowerKind: "student" | "teacher";
  borrower: {
    id: number;
    fullName: string;
    fatherName: string;
    identifier: string;
    identifierLabel: string;
    department: string;
    programOrDesignation: string;
    semester?: number | null;
    batchSession?: string | null;
    joiningDate?: string | null;
    email: string;
    mobileNumber: string;
    status: string;
  };
  book: {
    id: number;
    bookName: string;
    authorName: string;
    category: string;
    shelf: string;
    barcode: string;
    imagePath: string;
  };
  issueDate: string;
  dueDate: string;
  returnedAt: string | null;
  overdue: boolean;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  returnAllowed: boolean;
};

export type ReservationView = {
  id: number;
  bookId: number;
  bookName: string;
  status: "WAITING" | "READY";
  createdAt: string;
};

export type BookRequestView = {
  id: number;
  bookId: number | null;
  bookName: string;
  authorName: string;
  note: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  createdAt: string;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
};

export type NotificationView = {
  id: number;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type CatalogueBook = Awaited<ReturnType<typeof listBooks>>[number] & {
  available: boolean;
  holding: boolean;
  reservation: "WAITING" | "READY" | null;
};

const requestStatuses = ["PENDING", "APPROVED", "DECLINED"] as const;

export const bookRequestSchema = z.object({
  bookId: z.number().int().positive().optional(),
  bookName: z
    .string("Book name is required.")
    .trim()
    .min(1, "Book name is required.")
    .max(200, "Book name must be 200 characters or fewer."),
  authorName: z
    .string()
    .trim()
    .max(120, "Author name must be 120 characters or fewer.")
    .optional()
    .default(""),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer.").optional().default(""),
});

export const requestDecisionSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED"], "Choose approve or decline."),
});

export const profileContactSchema = z.object({
  mobileNumber: z
    .string("Mobile number is required.")
    .trim()
    .regex(/^\d{10,15}$/, "Mobile number must be 10 to 15 digits."),
  email: z
    .string("Email is required.")
    .trim()
    .email("Enter a valid email address.")
    .max(120, "Email must be 120 characters or fewer."),
});

type LoanRow = {
  id: number;
  barcode?: string | null;
  bookId: number;
  copyNumber?: number | null;
  studentId: number | null;
  teacherId: number | null;
  status?: string | null;
  borrowerAcceptedAt?: Date | null;
  adminApprovedAt?: Date | null;
  issueDate: Date;
  dueDate: Date;
  returnAllowedAt?: Date | null;
  book: {
    bookName: string;
    authorName?: string;
    category?: string;
    shelf?: string;
    barcode?: string;
    publisher?: string;
    imagePath?: string;
  };
  student: { fullName: string } | null;
  teacher: { fullName: string } | null;
};

function borrowerLabel(row: {
  student: { fullName: string } | null;
  teacher: { fullName: string } | null;
}) {
  if (row.student) {
    return { borrowerName: row.student.fullName, borrowerKind: "student" as const };
  }
  if (row.teacher) {
    return { borrowerName: row.teacher.fullName, borrowerKind: "teacher" as const };
  }
  return { borrowerName: "Unknown", borrowerKind: "student" as const };
}

function toLoanView(row: LoanRow): LoanView {
  const dueDate = utcDateToIsoDate(row.dueDate);
  const copyNum = row.copyNumber && row.copyNumber > 0 ? row.copyNumber : 1;
  return {
    id: row.id,
    loanBarcode: row.barcode ?? "",
    bookId: row.bookId,
    copyNumber: copyNum,
    copyCode: formatCopyCode(copyNum),
    studentId: row.studentId,
    teacherId: row.teacherId,
    status: row.status ?? "ACTIVE",
    borrowerAcceptedAt: row.borrowerAcceptedAt ? row.borrowerAcceptedAt.toISOString() : null,
    adminApprovedAt: row.adminApprovedAt ? row.adminApprovedAt.toISOString() : null,
    bookName: row.book.bookName,
    authorName: row.book.authorName ?? "",
    category: row.book.category ?? "",
    shelf: row.book.shelf ?? "",
    barcode: row.book.barcode ?? "",
    publisher: row.book.publisher ?? "",
    imagePath: row.book.imagePath ?? "",
    ...borrowerLabel(row),
    issueDate: utcDateToIsoDate(row.issueDate),
    dueDate,
    overdue: dueDate < calendarDateInKarachi(),
    returnAllowed: Boolean(row.returnAllowedAt),
    returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
  };
}

const loanInclude = {
  book: {
    select: {
      bookName: true,
      authorName: true,
      category: true,
      shelf: true,
      barcode: true,
      publisher: true,
      imagePath: true,
    },
  },
  student: { select: { fullName: true } },
  teacher: { select: { fullName: true } },
} as const;

async function assertActive(borrower: BorrowerRef) {
  if (borrower.role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: borrower.studentId },
    });
    if (!student) {
      throw new CirculationError("Sign in required.", 401);
    }
    if (student.status !== "ACTIVE") {
      throw new CirculationError(
        "A suspended account cannot borrow, reserve, or request books.",
      );
    }
    return;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: borrower.teacherId },
  });
  if (!teacher) {
    throw new CirculationError("Sign in required.", 401);
  }
  if (teacher.status !== "ACTIVE") {
    throw new CirculationError(
      "A suspended account cannot borrow, reserve, or request books.",
    );
  }
}

async function notify(
  tx: Prisma.TransactionClient,
  owner: { studentId: number | null; teacherId: number | null },
  message: string,
) {
  await tx.notification.create({
    data: {
      studentId: owner.studentId,
      teacherId: owner.teacherId,
      message,
    },
  });
}

async function promoteReservation(tx: Prisma.TransactionClient, bookId: number) {
  const config = await getCirculationConfig(tx);
  const [readyCount, activeLoans] = await Promise.all([
    tx.reservation.count({ where: { bookId, status: "READY" } }),
    tx.loan.count({ where: { bookId, returnedAt: null } }),
  ]);
  const freeCopies = config.defaultCopiesPerBook - activeLoans;
  if (readyCount >= freeCopies) {
    return;
  }

  const next = await tx.reservation.findFirst({
    where: { bookId, status: "WAITING" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!next) {
    return;
  }

  await tx.reservation.update({
    where: { id: next.id },
    data: { status: "READY" },
  });
  const book = await tx.book.findUnique({ where: { id: bookId } });
  await notify(
    tx,
    next,
    `${book?.bookName ?? "A book"} is ready to borrow.`,
  );
}

export async function searchCatalogue(query: string, borrower: BorrowerRef) {
  const books = await listBooks(query);
  const [loans, reservations] = await Promise.all([
    prisma.loan.findMany({
      where: { returnedAt: null, status: { not: "DECLINED" } },
      select: { bookId: true, studentId: true, teacherId: true, status: true },
    }),
    prisma.reservation.findMany({
      where: {
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
      select: { bookId: true, status: true },
    }),
  ]);

  const activeLoanCountMap = new Map<number, number>();
  for (const loan of loans) {
    activeLoanCountMap.set(
      loan.bookId,
      (activeLoanCountMap.get(loan.bookId) ?? 0) + 1,
    );
  }

  const holding = new Set(
    loans
      .filter((loan) => sameBorrower(loan, borrower) && loan.status === "ACTIVE")
      .map((loan) => loan.bookId),
  );
  const reserved = new Map(reservations.map((item) => [item.bookId, item.status]));

  const config = await getCirculationConfig();
  const totalCopies = config.defaultCopiesPerBook;

  return books.map((book) => {
    const borrowedCount = activeLoanCountMap.get(book.id) ?? 0;
    return {
      ...book,
      available: borrowedCount < totalCopies,
      totalCopies,
      borrowedCopies: borrowedCount,
      availableCopies: Math.max(0, totalCopies - borrowedCount),
      holding: holding.has(book.id),
      reservation:
        reserved.get(book.id) === "WAITING" || reserved.get(book.id) === "READY"
          ? (reserved.get(book.id) as "WAITING" | "READY")
          : null,
    };
  });
}

export async function bookCirculation(bookId: number, borrower: BorrowerRef) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return null;
  }

  const [activeLoansList, borrowerHoldingLoan, borrowerPendingOffer, reservation, pendingRequest] = await Promise.all([
    prisma.loan.findMany({
      where: { bookId, returnedAt: null, status: { not: "DECLINED" } },
      select: {
        id: true,
        copyNumber: true,
        dueDate: true,
        status: true,
        student: { select: { fullName: true, rollNumber: true } },
        teacher: { select: { fullName: true, employeeId: true } },
      },
    }),
    prisma.loan.findFirst({
      where: { bookId, ...borrowerWhere(borrower), returnedAt: null, status: "ACTIVE" },
      select: { id: true, copyNumber: true, returnAllowedAt: true },
    }),
    prisma.loan.findFirst({
      where: { bookId, ...borrowerWhere(borrower), returnedAt: null, status: "PENDING_BORROWER_PERMISSION" },
      select: { id: true, copyNumber: true },
    }),
    prisma.reservation.findFirst({
      where: {
        bookId,
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
      select: { status: true },
    }),
    prisma.bookRequest.findFirst({
      where: {
        ...borrowerWhere(borrower),
        status: "PENDING",
        OR: [
          { bookId },
          { bookName: book.bookName },
        ],
      },
      select: { id: true, status: true },
    }),
  ]);

  const activeLoans = activeLoansList.length;
  const config = await getCirculationConfig();
  const totalCopies = config.defaultCopiesPerBook;
  const monthlyBorrowLimit = config.monthlyBorrowLimit;

  const startOfMonth = getStartOfCurrentMonth();
  const monthlyCount = await prisma.loan.count({
    where: {
      ...borrowerWhere(borrower),
      createdAt: { gte: startOfMonth },
    },
  });

  const today = calendarDateInKarachi();
  const borrowedByCopy = new Map<number, (typeof activeLoansList)[number]>();
  for (const l of activeLoansList) {
    borrowedByCopy.set(l.copyNumber ?? 1, l);
  }

  const copies: BookCopyStatus[] = [];
  for (let c = 1; c <= totalCopies; c++) {
    const loan = borrowedByCopy.get(c);
    if (loan) {
      const dueStr = utcDateToIsoDate(loan.dueDate);
      const bName = loan.student?.fullName || loan.teacher?.fullName || "Borrower";
      const bId = loan.student?.rollNumber || loan.teacher?.employeeId || "";
      copies.push({
        copyNumber: c,
        copyCode: formatCopyCode(c),
        isBorrowed: true,
        loanId: loan.id,
        borrowerName: bName,
        borrowerKind: loan.student ? "student" : "teacher",
        identifier: bId,
        dueDate: dueStr,
        overdue: dueStr < today,
        status: loan.status ?? "ACTIVE",
      });
    } else {
      copies.push({
        copyNumber: c,
        copyCode: formatCopyCode(c),
        isBorrowed: false,
      });
    }
  }

  const userCopyNumber = borrowerHoldingLoan?.copyNumber || borrowerPendingOffer?.copyNumber || null;

  return {
    available: activeLoans < totalCopies,
    totalCopies,
    borrowedCopies: activeLoans,
    availableCopies: Math.max(0, totalCopies - activeLoans),
    holding: Boolean(borrowerHoldingLoan),
    holdingLoanId: borrowerHoldingLoan?.id ?? null,
    pendingOfferLoanId: borrowerPendingOffer?.id ?? null,
    userCopyNumber,
    userCopyCode: userCopyNumber ? formatCopyCode(userCopyNumber) : null,
    copies,
    returnAllowed: Boolean(borrowerHoldingLoan?.returnAllowedAt),
    returnAllowedAt: borrowerHoldingLoan?.returnAllowedAt
      ? borrowerHoldingLoan.returnAllowedAt.toISOString()
      : null,
    reservation:
      reservation?.status === "WAITING" || reservation?.status === "READY"
        ? reservation.status
        : null,
    hasPendingRequest: Boolean(pendingRequest),
    monthlyCount,
    canBorrowMonthly: monthlyCount < monthlyBorrowLimit,
    monthlyLimit: monthlyBorrowLimit,
  };
}

export async function borrowBook(borrower: BorrowerRef, bookId: number, requestedCopyNumber?: number) {
  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw new CirculationError("Book not found.", 404);
    }

    // 1. Borrower cannot borrow duplicate active copies of the same book
    const borrowerActiveLoan = await tx.loan.findFirst({
      where: { bookId, ...borrowerWhere(borrower), returnedAt: null },
    });
    if (borrowerActiveLoan) {
      throw new CirculationError("You already have an active copy of this book on loan.");
    }

    const config = await getCirculationConfig(tx);
    const totalCopies = config.defaultCopiesPerBook;
    const monthlyLimit = config.monthlyBorrowLimit;
    const maxBooks = borrower.role === "student" ? config.maxBooksPerStudent : config.maxBooksPerTeacher;
    const period = config.borrowingPeriodDays;

    // 2. Maximum copies per book
    const activeCopiesOut = await tx.loan.count({
      where: { bookId, returnedAt: null },
    });
    if (activeCopiesOut >= totalCopies) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed. No copies are available to borrow.`,
      );
    }

    // Determine copy number
    const activeBookLoans = await tx.loan.findMany({
      where: { bookId, returnedAt: null, status: { not: "DECLINED" } },
      select: { copyNumber: true },
    });
    const takenCopyNumbers = new Set(activeBookLoans.map((l) => l.copyNumber));
    let assignedCopyNumber = requestedCopyNumber;
    if (assignedCopyNumber) {
      if (assignedCopyNumber < 1 || assignedCopyNumber > totalCopies) {
        throw new CirculationError(
          `Invalid copy number. Please choose a copy between ${formatCopyCode(1)} and ${formatCopyCode(totalCopies)}.`,
        );
      }
      if (takenCopyNumbers.has(assignedCopyNumber)) {
        throw new CirculationError(
          `Copy ${formatCopyCode(assignedCopyNumber)} is currently borrowed. Please select an available copy.`,
        );
      }
    } else {
      for (let i = 1; i <= totalCopies; i++) {
        if (!takenCopyNumbers.has(i)) {
          assignedCopyNumber = i;
          break;
        }
      }
    }
    if (!assignedCopyNumber) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed.`,
      );
    }

    const nextReservation = await tx.reservation.findFirst({
      where: { bookId, status: { in: [...openReservation] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (nextReservation && !sameBorrower(nextReservation, borrower)) {
      throw new CirculationError("This copy is reserved.");
    }

    // 3. Monthly borrow limit
    const startOfMonth = getStartOfCurrentMonth();
    const monthlyCount = await tx.loan.count({
      where: {
        ...borrowerWhere(borrower),
        createdAt: { gte: startOfMonth },
      },
    });
    if (monthlyCount >= monthlyLimit) {
      throw new CirculationError(
        `Monthly borrowing limit reached: You can only borrow up to ${monthlyLimit} books per month (${monthlyCount}/${monthlyLimit} used).`,
      );
    }

    const held = await tx.loan.count({
      where: { ...borrowerWhere(borrower), returnedAt: null },
    });
    if (held >= maxBooks) {
      const borrowerRole = borrower.role === "student" ? "student" : "teacher";
      throw new CirculationError(
        `As a ${borrowerRole}, you can borrow up to ${maxBooks} ${maxBooks === 1 ? "book" : "books"} at a time.`,
      );
    }

    const dates = borrowingDates(period);
    const loan = await tx.loan.create({
      data: {
        bookId,
        copyNumber: assignedCopyNumber,
        ...borrowerData(borrower),
        issueDate: isoDateToUtcDate(dates.issueDate),
        dueDate: isoDateToUtcDate(dates.returnDate),
      },
      include: loanInclude,
    });

    let identifier = "USER";
    if (borrower.role === "student") {
      const studentRec = await tx.student.findUnique({
        where: { id: borrower.studentId },
        select: { rollNumber: true },
      });
      if (studentRec) identifier = studentRec.rollNumber;
    } else {
      const teacherRec = await tx.teacher.findUnique({
        where: { id: borrower.teacherId },
        select: { employeeId: true },
      });
      if (teacherRec) identifier = teacherRec.employeeId;
    }
    const cleanId = identifier.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ID";
    const prefix = borrower.role === "student" ? "STU" : "TCH";
    const generatedBarcode = `ISS-${prefix}-${cleanId}-${String(loan.id).padStart(4, "0")}`;
    await tx.loan.update({
      where: { id: loan.id },
      data: { barcode: generatedBarcode },
    });
    loan.barcode = generatedBarcode;

    const monthlyCountAfter = await tx.loan.count({
      where: {
        ...borrowerWhere(borrower),
        createdAt: { gte: startOfMonth },
      },
    });
    if (monthlyCountAfter > monthlyLimit) {
      throw new CirculationError(
        `Monthly borrowing limit reached: You can only borrow up to ${monthlyLimit} books per month.`,
      );
    }

    const heldAfter = await tx.loan.count({
      where: { ...borrowerWhere(borrower), returnedAt: null },
    });
    const copiesOut = await tx.loan.count({
      where: { bookId, returnedAt: null },
    });
    if (heldAfter > maxBooks) {
      throw new CirculationError(
        `You can borrow up to ${maxBooks} ${maxBooks === 1 ? "book" : "books"} at a time.`,
      );
    }
    if (copiesOut > totalCopies) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed.`,
      );
    }

    await tx.reservation.updateMany({
      where: {
        bookId,
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
      data: { status: "FULFILLED" },
    });

    await notify(
      tx,
      borrowerData(borrower),
      `You borrowed ${book.bookName}. Return it by ${formatDisplayDate(dates.returnDate)}.`,
    );

    return toLoanView(loan);
  });
}

export async function reserveBook(borrower: BorrowerRef, bookId: number) {
  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw new CirculationError("Book not found.", 404);
    }

    const activeLoan = await tx.loan.findFirst({
      where: { bookId, returnedAt: null },
    });
    if (!activeLoan) {
      throw new CirculationError("This book is available. Borrow it instead.");
    }
    if (sameBorrower(activeLoan, borrower)) {
      throw new CirculationError("You already have this book.");
    }

    const existing = await tx.reservation.findFirst({
      where: {
        bookId,
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
    });
    if (existing) {
      throw new CirculationError("You already have a reservation for this book.");
    }

    const reservation = await tx.reservation.create({
      data: {
        bookId,
        ...borrowerData(borrower),
        status: "WAITING",
      },
    });

    return {
      id: reservation.id,
      bookId,
      bookName: book.bookName,
      status: "WAITING" as const,
      createdAt: reservation.createdAt.toISOString(),
    };
  });
}

export async function cancelReservation(borrower: BorrowerRef, reservationId: number) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
    });
    if (
      !reservation ||
      !sameBorrower(reservation, borrower) ||
      (reservation.status !== "WAITING" && reservation.status !== "READY")
    ) {
      throw new CirculationError("Reservation not found.", 404);
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });

    if (reservation.status === "READY") {
      await promoteReservation(tx, reservation.bookId);
    }
  });
}

export async function listMyLoans(borrower: BorrowerRef) {
  const rows = await prisma.loan.findMany({
    where: { ...borrowerWhere(borrower), returnedAt: null },
    include: loanInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return rows.map(toLoanView);
}

export async function listActiveLoans() {
  const rows = await prisma.loan.findMany({
    where: { returnedAt: null },
    include: loanInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  return rows.map(toLoanView);
}

export async function listBorrowSummary(
  kind: "student" | "teacher",
): Promise<BorrowerBorrowSummary[]> {
  const startOfMonth = getStartOfCurrentMonth();
  const today = calendarDateInKarachi();
  const config = await getCirculationConfig();
  const maxMonthLimit = config.monthlyBorrowLimit;

  if (kind === "student") {
    const students = await prisma.student.findMany({
      include: {
        loans: {
          include: {
            book: {
              select: {
                id: true,
                bookName: true,
                barcode: true,
                shelf: true,
              },
            },
          },
          orderBy: [{ issueDate: "desc" }, { id: "desc" }],
        },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });

    return students.map((s) => {
      const monthLoans = s.loans.filter(
        (l) => new Date(l.createdAt) >= startOfMonth,
      );
      const activeLoans = s.loans.filter((l) => !l.returnedAt && l.status !== "DECLINED");
      return {
        id: s.id,
        fullName: s.fullName,
        identifier: s.rollNumber,
        department: s.department,
        email: s.email,
        status: s.status,
        monthCount: monthLoans.length,
        maxMonthLimit,
        canBorrow:
          monthLoans.length < maxMonthLimit && s.status === "ACTIVE",
        activeLoansCount: activeLoans.length,
        loans: s.loans.map((l) => {
          const due = utcDateToIsoDate(l.dueDate);
          const copyNum = l.copyNumber && l.copyNumber > 0 ? l.copyNumber : 1;
          return {
            id: l.id,
            bookId: l.bookId,
            copyNumber: copyNum,
            copyCode: formatCopyCode(copyNum),
            bookName: l.book.bookName,
            barcode: l.book.barcode,
            shelf: l.book.shelf,
            status: l.status ?? "ACTIVE",
            borrowerAcceptedAt: l.borrowerAcceptedAt ? l.borrowerAcceptedAt.toISOString() : null,
            adminApprovedAt: l.adminApprovedAt ? l.adminApprovedAt.toISOString() : null,
            issueDate: utcDateToIsoDate(l.issueDate),
            dueDate: due,
            returnedAt: l.returnedAt ? l.returnedAt.toISOString() : null,
            overdue: !l.returnedAt && due < today,
            returnAllowed: Boolean(l.returnAllowedAt),
            returnAllowedAt: l.returnAllowedAt ? l.returnAllowedAt.toISOString() : null,
          };
        }),
      };
    });
  }

  const teachers = await prisma.teacher.findMany({
    include: {
      loans: {
        include: {
          book: {
            select: {
              id: true,
              bookName: true,
              barcode: true,
              shelf: true,
            },
          },
        },
        orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      },
    },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
  });

  return teachers.map((t) => {
    const monthLoans = t.loans.filter(
      (l) => new Date(l.createdAt) >= startOfMonth,
    );
    const activeLoans = t.loans.filter((l) => !l.returnedAt && l.status !== "DECLINED");
    return {
      id: t.id,
      fullName: t.fullName,
      identifier: t.employeeId,
      department: t.department,
      designation: t.designation,
      email: t.email,
      status: t.status,
      monthCount: monthLoans.length,
      maxMonthLimit,
      canBorrow:
        monthLoans.length < maxMonthLimit && t.status === "ACTIVE",
      activeLoansCount: activeLoans.length,
      loans: t.loans.map((l) => {
        const due = utcDateToIsoDate(l.dueDate);
        const copyNum = l.copyNumber && l.copyNumber > 0 ? l.copyNumber : 1;
        return {
          id: l.id,
          bookId: l.bookId,
          copyNumber: copyNum,
          copyCode: formatCopyCode(copyNum),
          bookName: l.book.bookName,
          barcode: l.book.barcode,
          shelf: l.book.shelf,
          status: l.status ?? "ACTIVE",
          borrowerAcceptedAt: l.borrowerAcceptedAt ? l.borrowerAcceptedAt.toISOString() : null,
          adminApprovedAt: l.adminApprovedAt ? l.adminApprovedAt.toISOString() : null,
          issueDate: utcDateToIsoDate(l.issueDate),
          dueDate: due,
          returnedAt: l.returnedAt ? l.returnedAt.toISOString() : null,
          overdue: !l.returnedAt && due < today,
          returnAllowed: Boolean(l.returnAllowedAt),
          returnAllowedAt: l.returnAllowedAt ? l.returnAllowedAt.toISOString() : null,
        };
      }),
    };
  });
}

export async function adminIssueBook(
  bookId: number,
  target: { studentId?: number; teacherId?: number },
  requestedCopyNumber?: number,
) {
  if (!target.studentId && !target.teacherId) {
    throw new CirculationError("A valid student or teacher is required.", 400);
  }

  const borrower: BorrowerRef = target.studentId
    ? { role: "student", studentId: target.studentId }
    : { role: "teacher", teacherId: target.teacherId! };

  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book) {
      throw new CirculationError("Book not found.", 404);
    }

    const existingBorrowerLoan = await tx.loan.findFirst({
      where: {
        bookId,
        ...borrowerWhere(borrower),
        returnedAt: null,
        status: { not: "DECLINED" },
      },
    });
    if (existingBorrowerLoan) {
      throw new CirculationError(
        "This borrower already has an active copy or pending offer for this book.",
        400,
      );
    }

    const config = await getCirculationConfig(tx);
    const totalCopies = config.defaultCopiesPerBook;
    const monthlyLimit = config.monthlyBorrowLimit;
    const maxBooks = borrower.role === "student" ? config.maxBooksPerStudent : config.maxBooksPerTeacher;
    const period = config.borrowingPeriodDays;

    const activeCopiesOut = await tx.loan.count({
      where: { bookId, returnedAt: null, status: { not: "DECLINED" } },
    });
    if (activeCopiesOut >= totalCopies) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed (0 copies available).`,
        400,
      );
    }

    // Determine copy number
    const activeBookLoans = await tx.loan.findMany({
      where: { bookId, returnedAt: null, status: { not: "DECLINED" } },
      select: { copyNumber: true },
    });
    const takenCopyNumbers = new Set(activeBookLoans.map((l) => l.copyNumber));
    let assignedCopyNumber = requestedCopyNumber;
    if (assignedCopyNumber) {
      if (assignedCopyNumber < 1 || assignedCopyNumber > totalCopies) {
        throw new CirculationError(
          `Invalid copy number. Please choose a copy between ${formatCopyCode(1)} and ${formatCopyCode(totalCopies)}.`,
          400,
        );
      }
      if (takenCopyNumbers.has(assignedCopyNumber)) {
        throw new CirculationError(
          `Copy ${formatCopyCode(assignedCopyNumber)} is currently borrowed. Please select an available copy.`,
          400,
        );
      }
    } else {
      for (let i = 1; i <= totalCopies; i++) {
        if (!takenCopyNumbers.has(i)) {
          assignedCopyNumber = i;
          break;
        }
      }
    }
    if (!assignedCopyNumber) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed.`,
        400,
      );
    }

    const held = await tx.loan.count({
      where: { ...borrowerWhere(borrower), returnedAt: null, status: "ACTIVE" },
    });
    if (held >= maxBooks) {
      const kind = borrower.role === "student" ? "student" : "teacher";
      throw new CirculationError(
        `Borrowing limit reached: This ${kind} already holds ${held}/${maxBooks} books and cannot borrow more.`,
        400,
      );
    }

    const startOfMonth = getStartOfCurrentMonth();
    const monthlyCount = await tx.loan.count({
      where: {
        ...borrowerWhere(borrower),
        createdAt: { gte: startOfMonth },
      },
    });
    if (monthlyCount >= monthlyLimit) {
      const kind = borrower.role === "student" ? "student" : "teacher";
      throw new CirculationError(
        `Monthly borrowing limit reached: This ${kind} has already borrowed ${monthlyCount}/${monthlyLimit} books this month and cannot borrow more.`,
      );
    }

    // Check if borrower previously submitted a pending borrow request for this book
    const existingRequest = await tx.bookRequest.findFirst({
      where: {
        ...borrowerWhere(borrower),
        status: "PENDING",
        OR: [{ bookId }, { bookName: book.bookName }],
      },
    });

    const isPreRequested = Boolean(existingRequest);
    const status = isPreRequested ? "ACTIVE" : "PENDING_BORROWER_PERMISSION";
    const borrowerAcceptedAt = isPreRequested ? existingRequest!.createdAt : null;
    const adminApprovedAt = new Date();

    const dates = borrowingDates(period);

    const loan = await tx.loan.create({
      data: {
        bookId,
        copyNumber: assignedCopyNumber,
        ...borrowerData(borrower),
        status,
        borrowerAcceptedAt,
        adminApprovedAt,
        issueDate: isoDateToUtcDate(dates.issueDate),
        dueDate: isoDateToUtcDate(dates.returnDate),
      },
      include: loanInclude,
    });

    let identifier = "USER";
    if (borrower.role === "student") {
      const studentRec = await tx.student.findUnique({
        where: { id: borrower.studentId },
        select: { rollNumber: true },
      });
      if (studentRec) identifier = studentRec.rollNumber;
    } else {
      const teacherRec = await tx.teacher.findUnique({
        where: { id: borrower.teacherId },
        select: { employeeId: true },
      });
      if (teacherRec) identifier = teacherRec.employeeId;
    }
    const cleanId = identifier.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ID";
    const prefix = borrower.role === "student" ? "STU" : "TCH";
    const generatedBarcode = `ISS-${prefix}-${cleanId}-${String(loan.id).padStart(4, "0")}`;
    await tx.loan.update({
      where: { id: loan.id },
      data: { barcode: generatedBarcode },
    });
    loan.barcode = generatedBarcode;

    await tx.reservation.updateMany({
      where: {
        bookId,
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
      data: { status: "FULFILLED" },
    });

    if (isPreRequested) {
      await tx.bookRequest.update({
        where: { id: existingRequest!.id },
        data: { status: "APPROVED" },
      });
      await notify(
        tx,
        borrowerData(borrower),
        `Your borrow request for "${book.bookName}" was approved! Return it by ${formatDisplayDate(dates.returnDate)}.`,
      );
    } else {
      await notify(
        tx,
        borrowerData(borrower),
        `The library administrator offered to issue "${book.bookName}" to you. You can see it in Book ledger.`,
      );
    }

    // Decrease shelf capacity by 1 if book has an assigned shelf
    if (book.shelf && book.shelf.trim()) {
      const shelfRecord = await tx.shelf.findUnique({
        where: { shelfNumber: book.shelf.trim() },
      });
      if (shelfRecord && shelfRecord.capacity !== null && shelfRecord.capacity > 0) {
        await tx.shelf.update({
          where: { id: shelfRecord.id },
          data: { capacity: shelfRecord.capacity - 1 },
        });
      }
    }

    return toLoanView(loan);
  });
}

export async function borrowerAcceptLoan(borrower: BorrowerRef, loanId: number) {
  await assertActive(borrower);
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: loanInclude,
    });
    if (!loan || !sameBorrower(loan, borrower)) {
      throw new CirculationError("Loan not found.", 404);
    }
    if (loan.status !== "PENDING_BORROWER_PERMISSION") {
      throw new CirculationError("This loan does not require acceptance.");
    }
    const config = await getCirculationConfig(tx);
    const period = config.borrowingPeriodDays;
    const dates = borrowingDates(period);

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: {
        status: "ACTIVE",
        borrowerAcceptedAt: new Date(),
        issueDate: isoDateToUtcDate(dates.issueDate),
        dueDate: isoDateToUtcDate(dates.returnDate),
      },
      include: loanInclude,
    });

    await notify(
      tx,
      borrowerData(borrower),
      `You accepted the loan for "${loan.book.bookName}". Return it by ${formatDisplayDate(dates.returnDate)}.`,
    );

    return toLoanView(updated);
  });
}

export async function borrowerDeclineLoan(borrower: BorrowerRef, loanId: number) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: loanInclude,
    });
    if (!loan || !sameBorrower(loan, borrower)) {
      throw new CirculationError("Loan not found.", 404);
    }
    if (loan.status !== "PENDING_BORROWER_PERMISSION") {
      throw new CirculationError("This loan does not require acceptance.");
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: {
        status: "DECLINED",
        returnedAt: new Date(),
      },
      include: loanInclude,
    });

    await notify(
      tx,
      borrowerData(borrower),
      `You declined the loan offer for "${loan.book.bookName}".`,
    );

    return toLoanView(updated);
  });
}

export async function listTotalBooksSummary(): Promise<TotalBookSummary[]> {
  const books = await prisma.book.findMany({
    orderBy: [{ bookName: "asc" }, { id: "asc" }],
    include: {
      loans: {
        where: { returnedAt: null, status: { not: "DECLINED" } },
        include: {
          student: {
            select: {
              fullName: true,
              rollNumber: true,
              department: true,
            },
          },
          teacher: {
            select: {
              fullName: true,
              employeeId: true,
              department: true,
            },
          },
        },
        orderBy: [{ issueDate: "asc" }, { id: "asc" }],
      },
    },
  });

  const today = calendarDateInKarachi();
  const config = await getCirculationConfig();
  const totalCopies = config.defaultCopiesPerBook;

  return books.map((book) => {
    const activeBorrowers: ActiveBorrowerDetail[] = book.loans.map((loan) => {
      const due = utcDateToIsoDate(loan.dueDate);
      const copyNum = loan.copyNumber && loan.copyNumber > 0 ? loan.copyNumber : 1;
      const copyCode = formatCopyCode(copyNum);

      if (loan.student) {
        return {
          loanId: loan.id,
          copyNumber: copyNum,
          copyCode,
          borrowerName: loan.student.fullName,
          borrowerKind: "student" as const,
          identifier: loan.student.rollNumber,
          department: loan.student.department,
          issueDate: utcDateToIsoDate(loan.issueDate),
          dueDate: due,
          overdue: due < today,
          status: loan.status ?? "ACTIVE",
          borrowerAcceptedAt: loan.borrowerAcceptedAt ? loan.borrowerAcceptedAt.toISOString() : null,
          adminApprovedAt: loan.adminApprovedAt ? loan.adminApprovedAt.toISOString() : null,
          returnAllowed: Boolean(loan.returnAllowedAt),
          returnAllowedAt: loan.returnAllowedAt ? loan.returnAllowedAt.toISOString() : null,
        };
      }
      if (loan.teacher) {
        return {
          loanId: loan.id,
          copyNumber: copyNum,
          copyCode,
          borrowerName: loan.teacher.fullName,
          borrowerKind: "teacher" as const,
          identifier: loan.teacher.employeeId,
          department: loan.teacher.department,
          issueDate: utcDateToIsoDate(loan.issueDate),
          dueDate: due,
          overdue: due < today,
          status: loan.status ?? "ACTIVE",
          borrowerAcceptedAt: loan.borrowerAcceptedAt ? loan.borrowerAcceptedAt.toISOString() : null,
          adminApprovedAt: loan.adminApprovedAt ? loan.adminApprovedAt.toISOString() : null,
          returnAllowed: Boolean(loan.returnAllowedAt),
          returnAllowedAt: loan.returnAllowedAt ? loan.returnAllowedAt.toISOString() : null,
        };
      }
      return {
        loanId: loan.id,
        copyNumber: copyNum,
        copyCode,
        borrowerName: "Unknown",
        borrowerKind: "student" as const,
        identifier: "—",
        department: "—",
        issueDate: utcDateToIsoDate(loan.issueDate),
        dueDate: due,
        overdue: due < today,
        status: loan.status ?? "ACTIVE",
        borrowerAcceptedAt: loan.borrowerAcceptedAt ? loan.borrowerAcceptedAt.toISOString() : null,
        adminApprovedAt: loan.adminApprovedAt ? loan.adminApprovedAt.toISOString() : null,
        returnAllowed: Boolean(loan.returnAllowedAt),
        returnAllowedAt: loan.returnAllowedAt ? loan.returnAllowedAt.toISOString() : null,
      };
    });

    const borrowerByCopy = new Map<number, ActiveBorrowerDetail>();
    for (const b of activeBorrowers) {
      borrowerByCopy.set(b.copyNumber, b);
    }

    const copies: BookCopyStatus[] = [];
    for (let c = 1; c <= totalCopies; c++) {
      const borrower = borrowerByCopy.get(c);
      if (borrower) {
        copies.push({
          copyNumber: c,
          copyCode: formatCopyCode(c),
          isBorrowed: true,
          loanId: borrower.loanId,
          borrowerName: borrower.borrowerName,
          borrowerKind: borrower.borrowerKind,
          identifier: borrower.identifier,
          department: borrower.department,
          issueDate: borrower.issueDate,
          dueDate: borrower.dueDate,
          overdue: borrower.overdue,
          status: borrower.status,
          returnAllowed: borrower.returnAllowed,
        });
      } else {
        copies.push({
          copyNumber: c,
          copyCode: formatCopyCode(c),
          isBorrowed: false,
        });
      }
    }

    const borrowedCopies = book.loans.length;
    const availableCopies = Math.max(0, totalCopies - borrowedCopies);

    return {
      id: book.id,
      bookName: book.bookName,
      authorName: book.authorName,
      category: book.category,
      edition: book.edition,
      shelf: book.shelf,
      barcode: book.barcode,
      imagePath: book.imagePath,
      totalCopies,
      borrowedCopies,
      availableCopies,
      isAvailable: borrowedCopies < totalCopies,
      activeBorrowers,
      copies,
    };
  });
}

export async function allowReturn(borrower: BorrowerRef, loanId: number, allow: boolean) {
  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: loanInclude,
    });
    if (!loan || loan.returnedAt) {
      throw new CirculationError("Active loan not found.", 404);
    }

    if (!sameBorrower(loan, borrower)) {
      throw new CirculationError("You are not authorized to manage this loan.", 403);
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: {
        returnAllowedAt: allow ? new Date() : null,
      },
      include: loanInclude,
    });

    return toLoanView(updated);
  });
}

export async function returnLoan(loanId: number, force = false) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        book: { select: { shelf: true } },
        student: { select: { fullName: true } },
        teacher: { select: { fullName: true } },
      },
    });
    if (!loan || loan.returnedAt) {
      throw new CirculationError("Loan not found.", 404);
    }

    if (!loan.returnAllowedAt && !force) {
      const borrowerName =
        loan.student?.fullName ?? loan.teacher?.fullName ?? "the student/teacher";
      throw new CirculationError(
        `Cannot process return: Return permission has not been granted by ${borrowerName} yet. The borrower must allow return in the system first.`,
        400,
      );
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: { returnedAt: new Date() },
    });

    // Increase shelf capacity by 1 if book has an assigned shelf
    if (loan.book?.shelf && loan.book.shelf.trim()) {
      const shelfRecord = await tx.shelf.findUnique({
        where: { shelfNumber: loan.book.shelf.trim() },
      });
      if (shelfRecord && shelfRecord.capacity !== null) {
        await tx.shelf.update({
          where: { id: shelfRecord.id },
          data: { capacity: shelfRecord.capacity + 1 },
        });
      }
    }

    await promoteReservation(tx, loan.bookId);
  });
}

export async function listMyReservations(borrower: BorrowerRef) {
  const rows = await prisma.reservation.findMany({
    where: {
      ...borrowerWhere(borrower),
      status: { in: [...openReservation] },
    },
    include: { book: { select: { bookName: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    bookId: row.bookId,
    bookName: row.book.bookName,
    status: row.status as "WAITING" | "READY",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createBookRequest(
  borrower: BorrowerRef,
  input: z.infer<typeof bookRequestSchema>,
) {
  await assertActive(borrower);
  const row = await prisma.bookRequest.create({
    data: {
      ...borrowerData(borrower),
      bookId: input.bookId ?? null,
      bookName: input.bookName,
      authorName: input.authorName,
      note: input.note,
      status: "PENDING",
    },
    include: {
      student: { select: { fullName: true } },
      teacher: { select: { fullName: true } },
    },
  });
  return toRequestView(row);
}

export async function listMyRequests(borrower: BorrowerRef) {
  const rows = await prisma.bookRequest.findMany({
    where: borrowerWhere(borrower),
    include: {
      student: { select: { fullName: true } },
      teacher: { select: { fullName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toRequestView);
}

export async function listAllRequests() {
  const rows = await prisma.bookRequest.findMany({
    include: {
      student: { select: { fullName: true } },
      teacher: { select: { fullName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toRequestView);
}

export async function decideRequest(requestId: number, status: "APPROVED" | "DECLINED") {
  return prisma.$transaction(async (tx) => {
    const request = await tx.bookRequest.findUnique({
      where: { id: requestId },
      include: {
        student: { select: { id: true, rollNumber: true, fullName: true, status: true } },
        teacher: { select: { id: true, employeeId: true, fullName: true, status: true } },
      },
    });
    if (!request) {
      throw new CirculationError("Book request not found.", 404);
    }
    if (request.status !== "PENDING") {
      throw new CirculationError("This request has already been decided.");
    }

    if (status === "DECLINED") {
      await tx.bookRequest.update({
        where: { id: request.id },
        data: { status: "DECLINED" },
      });
      await notify(tx, request, `Your borrow request for "${request.bookName}" was declined.`);
      return;
    }

    // Status is "APPROVED"
    let book = request.bookId
      ? await tx.book.findUnique({ where: { id: request.bookId } })
      : null;
    if (!book) {
      book = await tx.book.findFirst({
        where: { bookName: { equals: request.bookName } },
      });
    }

    const borrower: BorrowerRef = request.studentId
      ? { role: "student", studentId: request.studentId }
      : { role: "teacher", teacherId: request.teacherId! };

    await assertActive(borrower);

    if (book) {
      const existingLoan = await tx.loan.findFirst({
        where: {
          bookId: book.id,
          ...borrowerWhere(borrower),
          returnedAt: null,
          status: { not: "DECLINED" },
        },
      });
      if (existingLoan) {
        throw new CirculationError("This reader already has an active copy or pending offer for this book.");
      }

      const config = await getCirculationConfig(tx);
      const totalCopies = config.defaultCopiesPerBook;
      const monthlyLimit = config.monthlyBorrowLimit;
      const maxBooks = borrower.role === "student" ? config.maxBooksPerStudent : config.maxBooksPerTeacher;
      const period = config.borrowingPeriodDays;

      const activeCopiesOut = await tx.loan.count({
        where: { bookId: book.id, returnedAt: null, status: { not: "DECLINED" } },
      });
      if (activeCopiesOut >= totalCopies) {
        throw new CirculationError(`All ${totalCopies} copies of "${book.bookName}" are currently borrowed.`);
      }

      const startOfMonth = getStartOfCurrentMonth();
      const monthlyCount = await tx.loan.count({
        where: {
          ...borrowerWhere(borrower),
          createdAt: { gte: startOfMonth },
        },
      });
      if (monthlyCount >= monthlyLimit) {
        throw new CirculationError(`Monthly borrow limit reached (${monthlyLimit} books/month).`);
      }

      const held = await tx.loan.count({
        where: { ...borrowerWhere(borrower), returnedAt: null, status: "ACTIVE" },
      });
      if (held >= maxBooks) {
        throw new CirculationError(`Reader already holds the maximum of ${maxBooks} books.`);
      }

      const dates = borrowingDates(period);
      const loan = await tx.loan.create({
        data: {
          bookId: book.id,
          ...borrowerData(borrower),
          status: "ACTIVE",
          adminApprovedAt: new Date(),
          borrowerAcceptedAt: request.createdAt,
          issueDate: isoDateToUtcDate(dates.issueDate),
          dueDate: isoDateToUtcDate(dates.returnDate),
        },
        include: loanInclude,
      });

      let identifier = "USER";
      if (borrower.role === "student") {
        identifier = request.student?.rollNumber || "STU";
      } else {
        identifier = request.teacher?.employeeId || "TCH";
      }
      const cleanId = identifier.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ID";
      const prefix = borrower.role === "student" ? "STU" : "TCH";
      const generatedBarcode = `ISS-${prefix}-${cleanId}-${String(loan.id).padStart(4, "0")}`;
      await tx.loan.update({
        where: { id: loan.id },
        data: { barcode: generatedBarcode },
      });

      await tx.reservation.updateMany({
        where: {
          bookId: book.id,
          ...borrowerWhere(borrower),
          status: { in: [...openReservation] },
        },
        data: { status: "FULFILLED" },
      });

      await tx.bookRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      });

      await notify(
        tx,
        borrowerData(borrower),
        `Your borrow request for "${book.bookName}" was approved! Return it by ${formatDisplayDate(dates.returnDate)}.`,
      );
    } else {
      await tx.bookRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED" },
      });
      await notify(tx, request, `Your request for "${request.bookName}" was approved.`);
    }
  });
}

function toRequestView(row: {
  id: number;
  bookId?: number | null;
  bookName: string;
  authorName: string;
  note: string;
  status: string;
  createdAt: Date;
  student: { fullName: string } | null;
  teacher: { fullName: string } | null;
}): BookRequestView {
  const status = requestStatuses.includes(row.status as (typeof requestStatuses)[number])
    ? (row.status as BookRequestView["status"])
    : "PENDING";
  return {
    id: row.id,
    bookId: row.bookId ?? null,
    bookName: row.bookName,
    authorName: row.authorName,
    note: row.note,
    status,
    createdAt: row.createdAt.toISOString(),
    ...borrowerLabel(row),
  };
}

export async function listNotifications(borrower: BorrowerRef) {
  const rows = await prisma.notification.findMany({
    where: borrowerWhere(borrower),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markNotificationsRead(borrower: BorrowerRef, ids: number[]) {
  await prisma.notification.updateMany({
    where: {
      ...borrowerWhere(borrower),
      readAt: null,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

export async function dashboardSummary(borrower: BorrowerRef) {
  const profile = await getProfile(borrower);
  if (!profile) {
    throw new CirculationError("Sign in required.", 401);
  }

  const [loans, reservations, pendingRequests, unreadNotifications] = await Promise.all([
    listMyLoans(borrower),
    prisma.reservation.count({
      where: { ...borrowerWhere(borrower), status: { in: [...openReservation] } },
    }),
    prisma.bookRequest.count({
      where: { ...borrowerWhere(borrower), status: "PENDING" },
    }),
    prisma.notification.count({
      where: { ...borrowerWhere(borrower), readAt: null },
    }),
  ]);

  return {
    fullName: profile.fullName,
    role: profile.role,
    activeLoans: loans.length,
    reservationCount: reservations,
    pendingRequests,
    unreadNotifications,
    loans,
  };
}

export async function getProfile(borrower: BorrowerRef) {
  if (borrower.role === "student") {
    const student = await getStudent(borrower.studentId);
    return student ? { role: "student" as const, ...student } : null;
  }

  const teacher = await getTeacher(borrower.teacherId);
  return teacher ? { role: "teacher" as const, ...teacher } : null;
}

export async function updateProfile(
  borrower: BorrowerRef,
  contact: z.infer<typeof profileContactSchema>,
  passwordHash?: string,
) {
  const data = {
    mobileNumber: contact.mobileNumber,
    email: contact.email.toLowerCase(),
    ...(passwordHash ? { passwordHash } : {}),
  };

  try {
    if (borrower.role === "student") {
      await prisma.student.update({
        where: { id: borrower.studentId },
        data,
      });
    } else {
      await prisma.teacher.update({
        where: { id: borrower.teacherId },
        data,
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CirculationError("This email is already in use.");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new CirculationError("Sign in required.", 401);
    }
    throw error;
  }

  return getProfile(borrower);
}

export type OverdueLoanView = {
  id: number;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  bookName: string;
  authorName: string;
  category: string;
  shelf: string;
  barcode: string;
  imagePath: string;
  borrowerId: number;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
  identifier: string;
  department: string;
  designation?: string;
  email: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  returnAllowed: boolean;
  returnAllowedAt: string | null;
};

export function calculateDaysOverdue(
  dueIsoDate: string,
  todayIsoDate = calendarDateInKarachi(),
): number {
  if (dueIsoDate >= todayIsoDate) return 0;
  const due = new Date(dueIsoDate + "T00:00:00Z");
  const today = new Date(todayIsoDate + "T00:00:00Z");
  const diffTime = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

const overdueLoanInclude = {
  book: {
    select: {
      id: true,
      bookName: true,
      authorName: true,
      category: true,
      shelf: true,
      barcode: true,
      imagePath: true,
    },
  },
  student: {
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      department: true,
      program: true,
      semester: true,
      email: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      department: true,
      designation: true,
      email: true,
    },
  },
} as const;

type OverdueLoanRow = {
  id: number;
  bookId: number;
  copyNumber?: number | null;
  studentId: number | null;
  teacherId: number | null;
  issueDate: Date;
  dueDate: Date;
  returnedAt?: Date | null;
  returnAllowedAt: Date | null;
  book: {
    id: number;
    bookName: string;
    authorName?: string;
    category?: string;
    shelf?: string;
    barcode?: string;
    imagePath?: string;
  };
  student: {
    id: number;
    fullName: string;
    rollNumber: string;
    department: string;
    program?: string;
    semester?: number;
    email: string;
  } | null;
  teacher: {
    id: number;
    fullName: string;
    employeeId: string;
    department: string;
    designation: string;
    email: string;
  } | null;
};

function toOverdueLoanView(row: OverdueLoanRow): OverdueLoanView {
  const today = calendarDateInKarachi();
  const dueDateStr = utcDateToIsoDate(row.dueDate);
  const issueDateStr = utcDateToIsoDate(row.issueDate);
  const daysOverdue = calculateDaysOverdue(dueDateStr, today);
  const copyNum = row.copyNumber && row.copyNumber > 0 ? row.copyNumber : 1;
  const copyCode = formatCopyCode(copyNum);

  if (row.student) {
    return {
      id: row.id,
      bookId: row.book.id,
      copyNumber: copyNum,
      copyCode,
      bookName: row.book.bookName,
      authorName: row.book.authorName ?? "",
      category: row.book.category ?? "",
      shelf: row.book.shelf ?? "",
      barcode: row.book.barcode ?? "",
      imagePath: row.book.imagePath ?? "",
      borrowerId: row.student.id,
      borrowerName: row.student.fullName,
      borrowerKind: "student",
      identifier: row.student.rollNumber,
      department: row.student.department,
      email: row.student.email,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      daysOverdue,
      returnAllowed: Boolean(row.returnAllowedAt),
      returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
    };
  }

  if (row.teacher) {
    return {
      id: row.id,
      bookId: row.book.id,
      copyNumber: copyNum,
      copyCode,
      bookName: row.book.bookName,
      authorName: row.book.authorName ?? "",
      category: row.book.category ?? "",
      shelf: row.book.shelf ?? "",
      barcode: row.book.barcode ?? "",
      imagePath: row.book.imagePath ?? "",
      borrowerId: row.teacher.id,
      borrowerName: row.teacher.fullName,
      borrowerKind: "teacher",
      identifier: row.teacher.employeeId,
      department: row.teacher.department,
      designation: row.teacher.designation,
      email: row.teacher.email,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      daysOverdue,
      returnAllowed: Boolean(row.returnAllowedAt),
      returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
    };
  }

  return {
    id: row.id,
    bookId: row.book.id,
    copyNumber: copyNum,
    copyCode,
    bookName: row.book.bookName,
    authorName: row.book.authorName ?? "",
    category: row.book.category ?? "",
    shelf: row.book.shelf ?? "",
    barcode: row.book.barcode ?? "",
    imagePath: row.book.imagePath ?? "",
    borrowerId: 0,
    borrowerName: "Unknown",
    borrowerKind: "student",
    identifier: "—",
    department: "—",
    email: "—",
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    daysOverdue,
    returnAllowed: Boolean(row.returnAllowedAt),
    returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
  };
}

export async function listOverdueLoans(
  kind?: "student" | "teacher",
): Promise<OverdueLoanView[]> {
  const today = calendarDateInKarachi();
  const todayUtc = isoDateToUtcDate(today);

  const whereClause: Prisma.LoanWhereInput = {
    returnedAt: null,
    dueDate: { lt: todayUtc },
  };

  if (kind === "student") {
    whereClause.studentId = { not: null };
  } else if (kind === "teacher") {
    whereClause.teacherId = { not: null };
  }

  const rows = await prisma.loan.findMany({
    where: whereClause,
    include: overdueLoanInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  return rows.map(toOverdueLoanView);
}

export async function listMyOverdueLoans(
  borrower: BorrowerRef,
): Promise<OverdueLoanView[]> {
  const today = calendarDateInKarachi();
  const todayUtc = isoDateToUtcDate(today);

  const rows = await prisma.loan.findMany({
    where: {
      ...borrowerWhere(borrower),
      returnedAt: null,
      dueDate: { lt: todayUtc },
    },
    include: overdueLoanInclude,
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  return rows.map(toOverdueLoanView);
}

export async function adminCreateOverdueLoan(input: {
  bookId: number;
  studentId?: number;
  teacherId?: number;
  issueDate: string;
  dueDate: string;
}) {
  if (!input.studentId && !input.teacherId) {
    throw new CirculationError("Select a student or teacher.", 400);
  }

  const borrower: BorrowerRef = input.studentId
    ? { role: "student", studentId: input.studentId }
    : { role: "teacher", teacherId: input.teacherId! };

  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: input.bookId } });
    if (!book) {
      throw new CirculationError("Book not found.", 404);
    }

    const activeLoan = await tx.loan.findFirst({
      where: { bookId: input.bookId, ...borrowerWhere(borrower), returnedAt: null },
    });
    if (activeLoan) {
      throw new CirculationError("This borrower already has an active copy of this book.", 400);
    }

    const activeCopiesOut = await tx.loan.count({
      where: { bookId: input.bookId, returnedAt: null },
    });
    const config = await getCirculationConfig(tx);
    const totalCopies = config.defaultCopiesPerBook;

    if (activeCopiesOut >= totalCopies) {
      throw new CirculationError(
        `All ${totalCopies} copies of this book are currently borrowed.`,
        400,
      );
    }

    const loan = await tx.loan.create({
      data: {
        bookId: input.bookId,
        ...borrowerData(borrower),
        issueDate: isoDateToUtcDate(input.issueDate),
        dueDate: isoDateToUtcDate(input.dueDate),
      },
      include: overdueLoanInclude,
    });

    await tx.reservation.updateMany({
      where: {
        bookId: input.bookId,
        ...borrowerWhere(borrower),
        status: { in: [...openReservation] },
      },
      data: { status: "FULFILLED" },
    });

    await notify(
      tx,
      borrowerData(borrower),
      `A loan was recorded for ${book.bookName}. Due date: ${formatDisplayDate(input.dueDate)}.`,
    );

    return toOverdueLoanView(loan);
  });
}

export async function adminUpdateLoanDates(
  loanId: number,
  data: { dueDate?: string; issueDate?: string },
) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: overdueLoanInclude,
    });
    if (!loan || loan.returnedAt) {
      throw new CirculationError("Active loan not found.", 404);
    }

    const updateData: Prisma.LoanUpdateInput = {};
    if (data.dueDate) {
      updateData.dueDate = isoDateToUtcDate(data.dueDate);
    }
    if (data.issueDate) {
      updateData.issueDate = isoDateToUtcDate(data.issueDate);
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: updateData,
      include: overdueLoanInclude,
    });

    return toOverdueLoanView(updated);
  });
}

export async function adminDeleteLoan(loanId: number) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
    });
    if (!loan) {
      throw new CirculationError("Loan record not found.", 404);
    }

    await tx.loan.delete({
      where: { id: loanId },
    });

    if (!loan.returnedAt) {
      await promoteReservation(tx, loan.bookId);
    }
  });
}

export type ReturnLoanView = {
  id: number;
  bookId: number;
  copyNumber: number;
  copyCode: string;
  bookName: string;
  authorName: string;
  category: string;
  shelf: string;
  barcode: string;
  imagePath: string;
  borrowerId: number;
  borrowerName: string;
  borrowerKind: "student" | "teacher";
  identifier: string;
  department: string;
  program?: string;
  semester?: number;
  designation?: string;
  email: string;
  issueDate: string;
  dueDate: string;
  returnedAt: string | null;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  overdue: boolean;
  daysOverdue: number;
  returnAllowed: boolean;
  returnAllowedAt: string | null;
};

function toReturnLoanView(row: OverdueLoanRow): ReturnLoanView {
  const today = calendarDateInKarachi();
  const dueDateStr = utcDateToIsoDate(row.dueDate);
  const issueDateStr = utcDateToIsoDate(row.issueDate);
  const daysOverdue = calculateDaysOverdue(dueDateStr, today);
  const overdue = dueDateStr < today;
  const isReturned = Boolean(row.returnedAt);
  const status: "ACTIVE" | "RETURNED" | "OVERDUE" = isReturned
    ? "RETURNED"
    : overdue
    ? "OVERDUE"
    : "ACTIVE";
  const copyNum = row.copyNumber && row.copyNumber > 0 ? row.copyNumber : 1;
  const copyCode = formatCopyCode(copyNum);

  if (row.student) {
    return {
      id: row.id,
      bookId: row.book.id,
      copyNumber: copyNum,
      copyCode,
      bookName: row.book.bookName,
      authorName: row.book.authorName ?? "",
      category: row.book.category ?? "",
      shelf: row.book.shelf ?? "",
      barcode: row.book.barcode ?? "",
      imagePath: row.book.imagePath ?? "",
      borrowerId: row.student.id,
      borrowerName: row.student.fullName,
      borrowerKind: "student",
      identifier: row.student.rollNumber,
      department: row.student.department,
      program: row.student.program ?? "",
      semester: row.student.semester,
      email: row.student.email,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
      status,
      overdue,
      daysOverdue,
      returnAllowed: Boolean(row.returnAllowedAt),
      returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
    };
  }

  if (row.teacher) {
    return {
      id: row.id,
      bookId: row.book.id,
      copyNumber: copyNum,
      copyCode,
      bookName: row.book.bookName,
      authorName: row.book.authorName ?? "",
      category: row.book.category ?? "",
      shelf: row.book.shelf ?? "",
      barcode: row.book.barcode ?? "",
      imagePath: row.book.imagePath ?? "",
      borrowerId: row.teacher.id,
      borrowerName: row.teacher.fullName,
      borrowerKind: "teacher",
      identifier: row.teacher.employeeId,
      department: row.teacher.department,
      designation: row.teacher.designation,
      email: row.teacher.email,
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
      status,
      overdue,
      daysOverdue,
      returnAllowed: Boolean(row.returnAllowedAt),
      returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
    };
  }

  return {
    id: row.id,
    bookId: row.book.id,
    copyNumber: copyNum,
    copyCode,
    bookName: row.book.bookName,
    authorName: row.book.authorName ?? "",
    category: row.book.category ?? "",
    shelf: row.book.shelf ?? "",
    barcode: row.book.barcode ?? "",
    imagePath: row.book.imagePath ?? "",
    borrowerId: 0,
    borrowerName: "Unknown",
    borrowerKind: "student",
    identifier: "—",
    department: "—",
    email: "—",
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
    status,
    overdue,
    daysOverdue,
    returnAllowed: Boolean(row.returnAllowedAt),
    returnAllowedAt: row.returnAllowedAt ? row.returnAllowedAt.toISOString() : null,
  };
}

export async function listReturnLoans(options?: {
  kind?: "student" | "teacher";
  borrower?: BorrowerRef;
  includeReturned?: boolean;
  onlyReturned?: boolean;
  onlyOverdue?: boolean;
}): Promise<ReturnLoanView[]> {
  const whereClause: Prisma.LoanWhereInput = {};

  if (options?.onlyOverdue) {
    const today = calendarDateInKarachi();
    const todayUtc = isoDateToUtcDate(today);
    whereClause.returnedAt = null;
    whereClause.dueDate = { lt: todayUtc };
  } else if (options?.onlyReturned) {
    whereClause.returnedAt = { not: null };
  } else if (!options?.includeReturned) {
    whereClause.returnedAt = null;
  }

  if (options?.borrower) {
    Object.assign(whereClause, borrowerWhere(options.borrower));
  } else if (options?.kind === "student") {
    whereClause.studentId = { not: null };
  } else if (options?.kind === "teacher") {
    whereClause.teacherId = { not: null };
  }

  const rows = await prisma.loan.findMany({
    where: whereClause,
    include: overdueLoanInclude,
    orderBy: options?.onlyReturned
      ? [{ returnedAt: "desc" }, { id: "desc" }]
      : [{ dueDate: "asc" }, { id: "asc" }],
  });

  return rows.map(toReturnLoanView);
}

export async function adminReturnBook(loanId: number) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        book: { select: { id: true, bookName: true, shelf: true } },
        student: { select: { id: true, fullName: true, rollNumber: true } },
        teacher: { select: { id: true, fullName: true, employeeId: true } },
      },
    });

    if (!loan) {
      throw new CirculationError("Loan not found.", 404);
    }

    if (loan.returnedAt) {
      throw new CirculationError("This book has already been returned.", 400);
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: {
        returnedAt: new Date(),
        status: "RETURNED",
      },
      include: overdueLoanInclude,
    });

    // Increase shelf capacity by 1 if book has an assigned shelf
    if (loan.book?.shelf && loan.book.shelf.trim()) {
      const shelfRecord = await tx.shelf.findUnique({
        where: { shelfNumber: loan.book.shelf.trim() },
      });
      if (shelfRecord && shelfRecord.capacity !== null) {
        await tx.shelf.update({
          where: { id: shelfRecord.id },
          data: { capacity: shelfRecord.capacity + 1 },
        });
      }
    }

    await promoteReservation(tx, loan.bookId);

    if (loan.studentId) {
      await notify(
        tx,
        { studentId: loan.studentId, teacherId: null },
        `Your borrowed book "${loan.book.bookName}" was returned by the administrator.`,
      );
    } else if (loan.teacherId) {
      await notify(
        tx,
        { studentId: null, teacherId: loan.teacherId },
        `Your borrowed book "${loan.book.bookName}" was returned by the administrator.`,
      );
    }

    return toReturnLoanView(updated);
  });
}

export async function borrowerReturnBook(borrower: BorrowerRef, loanId: number) {
  await assertActive(borrower);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        book: { select: { bookName: true, shelf: true } },
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (!loan) {
      throw new CirculationError("Loan not found.", 404);
    }

    if (loan.returnedAt) {
      throw new CirculationError("This book has already been returned.", 400);
    }

    if (!sameBorrower(loan, borrower)) {
      throw new CirculationError("You are not authorized to return this book.", 403);
    }

    const updated = await tx.loan.update({
      where: { id: loan.id },
      data: { returnedAt: new Date() },
      include: overdueLoanInclude,
    });

    // Increase shelf capacity by 1 if book has an assigned shelf
    if (loan.book?.shelf && loan.book.shelf.trim()) {
      const shelfRecord = await tx.shelf.findUnique({
        where: { shelfNumber: loan.book.shelf.trim() },
      });
      if (shelfRecord && shelfRecord.capacity !== null) {
        await tx.shelf.update({
          where: { id: shelfRecord.id },
          data: { capacity: shelfRecord.capacity + 1 },
        });
      }
    }

    await promoteReservation(tx, loan.bookId);

    await notify(
      tx,
      borrowerData(borrower),
      `You successfully returned ${loan.book.bookName}.`,
    );

    return toReturnLoanView(updated);
  });
}

export async function backfillLoanBarcodes() {
  const unbarcodedLoans = await prisma.loan.findMany({
    where: { barcode: null },
    include: {
      student: { select: { rollNumber: true } },
      teacher: { select: { employeeId: true } },
    },
  });

  for (const loan of unbarcodedLoans) {
    const isStudent = Boolean(loan.studentId);
    const identifier = isStudent
      ? loan.student?.rollNumber || `S${loan.studentId}`
      : loan.teacher?.employeeId || `T${loan.teacherId}`;
    const cleanId = identifier.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ID";
    const prefix = isStudent ? "STU" : "TCH";
    const generatedBarcode = `ISS-${prefix}-${cleanId}-${String(loan.id).padStart(4, "0")}`;

    await prisma.loan.update({
      where: { id: loan.id },
      data: { barcode: generatedBarcode },
    });
  }
}

export async function listLoanBarcodes(
  filter: "student" | "teacher" | "all" = "all",
): Promise<BarcodeLoanItem[]> {
  await backfillLoanBarcodes();

  const whereClause: { studentId?: object; teacherId?: object } = {};
  if (filter === "student") {
    whereClause.studentId = { not: null };
  } else if (filter === "teacher") {
    whereClause.teacherId = { not: null };
  }

  const loans = await prisma.loan.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      book: true,
      student: true,
      teacher: true,
    },
  });

  const today = calendarDateInKarachi();

  return loans.map((loan): BarcodeLoanItem => {
    const isStudent = Boolean(loan.student);
    const borrowerKind = isStudent ? "student" : "teacher";
    const dueDateStr = utcDateToIsoDate(loan.dueDate);
    const issueDateStr = utcDateToIsoDate(loan.issueDate);
    const isReturned = Boolean(loan.returnedAt);
    const isOverdue = !isReturned && dueDateStr < today;
    const status: "ACTIVE" | "RETURNED" | "OVERDUE" = isReturned
      ? "RETURNED"
      : isOverdue
      ? "OVERDUE"
      : "ACTIVE";

    const borrowerInfo = isStudent && loan.student
      ? {
          id: loan.student.id,
          fullName: loan.student.fullName,
          fatherName: loan.student.fatherName,
          identifier: loan.student.rollNumber,
          identifierLabel: "Roll Number",
          department: loan.student.department,
          programOrDesignation: loan.student.program,
          semester: loan.student.semester,
          batchSession: loan.student.batchSession,
          email: loan.student.email,
          mobileNumber: loan.student.mobileNumber,
          status: loan.student.status,
        }
      : loan.teacher
      ? {
          id: loan.teacher.id,
          fullName: loan.teacher.fullName,
          fatherName: loan.teacher.fatherName,
          identifier: loan.teacher.employeeId,
          identifierLabel: "Employee ID",
          department: loan.teacher.department,
          programOrDesignation: loan.teacher.designation,
          joiningDate: utcDateToIsoDate(loan.teacher.joiningDate),
          email: loan.teacher.email,
          mobileNumber: loan.teacher.mobileNumber,
          status: loan.teacher.status,
        }
      : {
          id: 0,
          fullName: "Unknown",
          fatherName: "—",
          identifier: "—",
          identifierLabel: "Identifier",
          department: "—",
          programOrDesignation: "—",
          email: "—",
          mobileNumber: "—",
          status: "UNKNOWN",
        };

    const copyNum = loan.copyNumber && loan.copyNumber > 0 ? loan.copyNumber : 1;
    return {
      loanId: loan.id,
      barcode: loan.barcode || `ISS-${isStudent ? "STU" : "TCH"}-0000-${loan.id}`,
      copyNumber: copyNum,
      copyCode: formatCopyCode(copyNum),
      borrowerKind,
      borrower: borrowerInfo,
      book: {
        id: loan.book.id,
        bookName: loan.book.bookName,
        authorName: loan.book.authorName,
        category: loan.book.category,
        shelf: loan.book.shelf,
        barcode: loan.book.barcode,
        imagePath: loan.book.imagePath,
      },
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      returnedAt: loan.returnedAt ? utcDateToIsoDate(loan.returnedAt) : null,
      overdue: isOverdue,
      status,
      returnAllowed: Boolean(loan.returnAllowedAt),
    };
  });
}

export async function findLoanByBarcode(code: string): Promise<BarcodeLoanItem | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  await backfillLoanBarcodes();

  // 1. Exact match on loan.barcode
  let loan = await prisma.loan.findFirst({
    where: {
      barcode: {
        equals: trimmed,
      },
    },
    include: {
      book: true,
      student: true,
      teacher: true,
    },
  });

  // 2. Case-insensitive loan.barcode match or search
  if (!loan) {
    const allMatching = await prisma.loan.findMany({
      where: {
        barcode: {
          not: null,
        },
      },
      include: {
        book: true,
        student: true,
        teacher: true,
      },
      orderBy: { createdAt: "desc" },
    });
    loan = allMatching.find((l) => l.barcode?.toLowerCase() === trimmed.toLowerCase()) || null;
  }

  // 3. Fallback: match by Student rollNumber (finds their most recent loan)
  if (!loan) {
    loan = await prisma.loan.findFirst({
      where: {
        student: {
          rollNumber: {
            equals: trimmed,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        book: true,
        student: true,
        teacher: true,
      },
    });
  }

  // 4. Fallback: match by Teacher employeeId (finds their most recent loan)
  if (!loan) {
    loan = await prisma.loan.findFirst({
      where: {
        teacher: {
          employeeId: {
            equals: trimmed,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        book: true,
        student: true,
        teacher: true,
      },
    });
  }

  // 5. Fallback: match by Book barcode (finds active or most recent loan for this book)
  if (!loan) {
    loan = await prisma.loan.findFirst({
      where: {
        book: {
          barcode: {
            equals: trimmed,
          },
        },
      },
      orderBy: [{ returnedAt: "asc" }, { createdAt: "desc" }],
      include: {
        book: true,
        student: true,
        teacher: true,
      },
    });
  }

  if (!loan) return null;

  const today = calendarDateInKarachi();
  const isStudent = Boolean(loan.student);
  const borrowerKind = isStudent ? "student" : "teacher";
  const dueDateStr = utcDateToIsoDate(loan.dueDate);
  const issueDateStr = utcDateToIsoDate(loan.issueDate);
  const isReturned = Boolean(loan.returnedAt);
  const isOverdue = !isReturned && dueDateStr < today;
  const status: "ACTIVE" | "RETURNED" | "OVERDUE" = isReturned
    ? "RETURNED"
    : isOverdue
    ? "OVERDUE"
    : "ACTIVE";

  const borrowerInfo = isStudent && loan.student
    ? {
        id: loan.student.id,
        fullName: loan.student.fullName,
        fatherName: loan.student.fatherName,
        identifier: loan.student.rollNumber,
        identifierLabel: "Roll Number",
        department: loan.student.department,
        programOrDesignation: loan.student.program,
        semester: loan.student.semester,
        batchSession: loan.student.batchSession,
        email: loan.student.email,
        mobileNumber: loan.student.mobileNumber,
        status: loan.student.status,
      }
    : loan.teacher
    ? {
        id: loan.teacher.id,
        fullName: loan.teacher.fullName,
        fatherName: loan.teacher.fatherName,
        identifier: loan.teacher.employeeId,
        identifierLabel: "Employee ID",
        department: loan.teacher.department,
        programOrDesignation: loan.teacher.designation,
        joiningDate: utcDateToIsoDate(loan.teacher.joiningDate),
        email: loan.teacher.email,
        mobileNumber: loan.teacher.mobileNumber,
        status: loan.teacher.status,
      }
    : {
        id: 0,
        fullName: "Unknown",
        fatherName: "—",
        identifier: "—",
        identifierLabel: "Identifier",
        department: "—",
        programOrDesignation: "—",
        email: "—",
        mobileNumber: "—",
        status: "UNKNOWN",
      };

  const copyNum = loan.copyNumber && loan.copyNumber > 0 ? loan.copyNumber : 1;

  return {
    loanId: loan.id,
    barcode: loan.barcode || `ISS-${isStudent ? "STU" : "TCH"}-0000-${loan.id}`,
    copyNumber: copyNum,
    copyCode: formatCopyCode(copyNum),
    borrowerKind,
    borrower: borrowerInfo,
    book: {
      id: loan.book.id,
      bookName: loan.book.bookName,
      authorName: loan.book.authorName,
      category: loan.book.category,
      shelf: loan.book.shelf,
      barcode: loan.book.barcode,
      imagePath: loan.book.imagePath,
    },
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    returnedAt: loan.returnedAt ? utcDateToIsoDate(loan.returnedAt) : null,
    overdue: isOverdue,
    status,
    returnAllowed: Boolean(loan.returnAllowedAt),
  };
}


