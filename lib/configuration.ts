import { z } from "zod";
import {
  CONFIGURATION_ID,
  DEFAULT_BORROWING_PERIOD_DAYS,
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_COPIES_PER_BOOK,
  DEFAULT_LIBRARY_NAME,
  DEFAULT_MAX_BOOKS_PER_STUDENT,
  DEFAULT_MAX_BOOKS_PER_TEACHER,
  DEFAULT_MONTHLY_BORROW_LIMIT,
  DEFAULT_BARCODE_START,
  DEFAULT_BARCODE_END,
  MAX_BORROWING_PERIOD_DAYS,
  MAX_COPIES_PER_BOOK,
  MAX_MONTHLY_BORROW_LIMIT,
  MIN_BOOKS_PER_BORROWER,
  MAX_BOOKS_PER_BORROWER,
  MIN_BORROWING_PERIOD_DAYS,
  MIN_COPIES_PER_BOOK,
  MIN_MONTHLY_BORROW_LIMIT,
} from "@/lib/defaults";
import { borrowingDates } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { invalidateCirculationConfigCache } from "@/lib/circulation";

export const defaultConfiguration = {
  id: CONFIGURATION_ID,
  libraryName: DEFAULT_LIBRARY_NAME,
  contactEmail: DEFAULT_CONTACT_EMAIL,
  borrowingPeriodDays: DEFAULT_BORROWING_PERIOD_DAYS,
  maxBooksPerStudent: DEFAULT_MAX_BOOKS_PER_STUDENT,
  maxBooksPerTeacher: DEFAULT_MAX_BOOKS_PER_TEACHER,
  monthlyBorrowLimit: DEFAULT_MONTHLY_BORROW_LIMIT,
  defaultCopiesPerBook: DEFAULT_COPIES_PER_BOOK,
  barcodeStart: DEFAULT_BARCODE_START,
  barcodeEnd: DEFAULT_BARCODE_END,
};

export type ParsedBarcode = {
  prefix: string;
  number: number;
  padLength: number;
};

export function parseBarcodePattern(barcode: string): ParsedBarcode | null {
  if (!barcode) return null;
  const match = barcode.trim().match(/^([A-Za-z0-9_-]*?)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const digits = match[2];
  const number = parseInt(digits, 10);
  if (isNaN(number) || number < 0) return null;
  return {
    prefix,
    number,
    padLength: digits.length,
  };
}

export const configurationInputSchema = z
  .object({
    libraryName: z
      .string("Library name is required.")
      .trim()
      .min(1, "Library name is required.")
      .max(120, "Library name must be 120 characters or fewer."),
    contactEmail: z
      .string("Contact email is required.")
      .trim()
      .email("Enter a valid contact email address.")
      .max(120, "Email must be 120 characters or fewer."),
    borrowingPeriodDays: z
      .number("Borrowing period must be a whole number of days.")
      .int("Borrowing period must be a whole number of days.")
      .min(MIN_BORROWING_PERIOD_DAYS, `Borrowing period must be at least ${MIN_BORROWING_PERIOD_DAYS} day.`)
      .max(MAX_BORROWING_PERIOD_DAYS, `Borrowing period cannot exceed ${MAX_BORROWING_PERIOD_DAYS} days.`),
    maxBooksPerStudent: z
      .number("Maximum books for students must be a whole number.")
      .int("Maximum books for students must be a whole number.")
      .min(MIN_BOOKS_PER_BORROWER, `Students must be allowed at least ${MIN_BOOKS_PER_BORROWER} book.`)
      .max(MAX_BOOKS_PER_BORROWER, `Maximum books for students cannot exceed ${MAX_BOOKS_PER_BORROWER}.`),
    maxBooksPerTeacher: z
      .number("Maximum books for teachers must be a whole number.")
      .int("Maximum books for teachers must be a whole number.")
      .min(MIN_BOOKS_PER_BORROWER, `Teachers must be allowed at least ${MIN_BOOKS_PER_BORROWER} book.`)
      .max(MAX_BOOKS_PER_BORROWER, `Maximum books for teachers cannot exceed ${MAX_BOOKS_PER_BORROWER}.`),
    monthlyBorrowLimit: z
      .number("Monthly borrow limit must be a whole number.")
      .int("Monthly borrow limit must be a whole number.")
      .min(MIN_MONTHLY_BORROW_LIMIT, `Monthly limit must be at least ${MIN_MONTHLY_BORROW_LIMIT} book.`)
      .max(MAX_MONTHLY_BORROW_LIMIT, `Monthly limit cannot exceed ${MAX_MONTHLY_BORROW_LIMIT} books.`),
    defaultCopiesPerBook: z
      .number("Default copies per book must be a whole number.")
      .int("Default copies per book must be a whole number.")
      .min(MIN_COPIES_PER_BOOK, `Each title must have at least ${MIN_COPIES_PER_BOOK} copy.`)
      .max(MAX_COPIES_PER_BOOK, `Default copies per book cannot exceed ${MAX_COPIES_PER_BOOK}.`),
    barcodeStart: z
      .string("Barcode start is required.")
      .trim()
      .min(1, "Barcode start is required.")
      .max(40, "Barcode start must be 40 characters or fewer."),
    barcodeEnd: z
      .string("Barcode end is required.")
      .trim()
      .min(1, "Barcode end is required.")
      .max(40, "Barcode end must be 40 characters or fewer."),
  })
  .superRefine((data, ctx) => {
    const startParsed = parseBarcodePattern(data.barcodeStart);
    if (!startParsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Barcode start must end with numbers (e.g. BC-001).",
        path: ["barcodeStart"],
      });
    }
    const endParsed = parseBarcodePattern(data.barcodeEnd);
    if (!endParsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Barcode end must end with numbers (e.g. BC-100).",
        path: ["barcodeEnd"],
      });
    }
    if (startParsed && endParsed) {
      if (startParsed.prefix !== endParsed.prefix) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Prefix mismatch: barcode start prefix "${startParsed.prefix}" must match barcode end prefix "${endParsed.prefix}".`,
          path: ["barcodeEnd"],
        });
      } else if (endParsed.number < startParsed.number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Barcode end number (${endParsed.number}) must be greater than or equal to barcode start number (${startParsed.number}).`,
          path: ["barcodeEnd"],
        });
      }
    }
  });

export type ConfigurationInput = z.infer<typeof configurationInputSchema>;

type ConfigurationRow = {
  libraryName: string;
  contactEmail: string;
  borrowingPeriodDays: number;
  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  monthlyBorrowLimit: number;
  defaultCopiesPerBook: number;
  barcodeStart?: string | null;
  barcodeEnd?: string | null;
  updatedAt: Date;
};

export function toConfigurationView(row: ConfigurationRow) {
  return {
    libraryName: row.libraryName,
    contactEmail: row.contactEmail,
    borrowingPeriodDays: row.borrowingPeriodDays,
    maxBooksPerStudent: row.maxBooksPerStudent,
    maxBooksPerTeacher: row.maxBooksPerTeacher,
    monthlyBorrowLimit: row.monthlyBorrowLimit,
    defaultCopiesPerBook: row.defaultCopiesPerBook,
    barcodeStart: row.barcodeStart || DEFAULT_BARCODE_START,
    barcodeEnd: row.barcodeEnd || DEFAULT_BARCODE_END,
    updatedAt: row.updatedAt.toISOString(),
    ...borrowingDates(row.borrowingPeriodDays),
  };
}

let cachedConfigurationView: { data: ReturnType<typeof toConfigurationView>; expiresAt: number } | null = null;

export async function getConfiguration() {
  const now = Date.now();
  if (cachedConfigurationView && cachedConfigurationView.expiresAt > now) {
    return cachedConfigurationView.data;
  }

  const row = await prisma.masterConfiguration.upsert({
    where: { id: CONFIGURATION_ID },
    update: {},
    create: defaultConfiguration,
  });

  const view = toConfigurationView(row);
  cachedConfigurationView = { data: view, expiresAt: now + 60_000 };
  return view;
}

export async function updateConfiguration(
  input: ConfigurationInput,
  adminPasswordHash?: string,
) {
  const row = await prisma.masterConfiguration.upsert({
    where: { id: CONFIGURATION_ID },
    update: input,
    create: { id: CONFIGURATION_ID, ...input },
  });

  if (adminPasswordHash) {
    await prisma.$executeRaw`
      UPDATE MasterConfiguration
      SET adminPasswordHash = ${adminPasswordHash}
      WHERE id = ${CONFIGURATION_ID}
    `;
  }

  cachedConfigurationView = null;
  invalidateCirculationConfigCache();

  return toConfigurationView(row);
}
