import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  calendarDateInKarachi,
  isValidIsoDate,
  isoDateToUtcDate,
  utcDateToIsoDate,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const genders = ["MALE", "FEMALE"] as const;
export const studentStatuses = ["ACTIVE", "SUSPENDED"] as const;

export type Gender = (typeof genders)[number];
export type StudentStatus = (typeof studentStatuses)[number];

const requiredText = (label: string, max: number) =>
  z
    .string(`${label} is required.`)
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const studentInputSchema = z
  .object({
    rollNumber: requiredText("Roll number", 30),
    fullName: requiredText("Full name", 120),
    fatherName: requiredText("Father name", 120),
    gender: z.enum(genders, "Select a gender."),
    dateOfBirth: z.string("Date of birth is required."),
    department: requiredText("Department", 120),
    program: requiredText("Program", 120),
    semester: z
      .number("Semester must be a whole number from 1 to 12.")
      .int("Semester must be a whole number from 1 to 12.")
      .min(1, "Semester must be from 1 to 12.")
      .max(12, "Semester must be from 1 to 12."),
    batchSession: requiredText("Batch/session", 40),
    enrollmentDate: z.string("Enrollment date is required."),
    mobileNumber: z
      .string("Mobile number is required.")
      .trim()
      .regex(/^\d{10,15}$/, "Mobile number must be 10 to 15 digits."),
    email: z
      .string("Email is required.")
      .trim()
      .email("Enter a valid email address.")
      .max(120, "Email must be 120 characters or fewer."),
  })
  .superRefine((value, ctx) => {
    if (!isValidIsoDate(value.dateOfBirth)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Enter a valid date of birth.",
      });
    } else if (value.dateOfBirth >= calendarDateInKarachi()) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth must be before today.",
      });
    }

    if (!isValidIsoDate(value.enrollmentDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["enrollmentDate"],
        message: "Enter a valid enrollment date.",
      });
    } else if (
      isValidIsoDate(value.dateOfBirth) &&
      value.enrollmentDate < value.dateOfBirth
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["enrollmentDate"],
        message: "Enrollment date must be on or after the date of birth.",
      });
    }
  });

export const studentStatusSchema = z.object({
  status: z.enum(studentStatuses, "Status must be active or suspended."),
});

export type StudentInput = z.infer<typeof studentInputSchema>;

type StudentRow = {
  id: number;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  gender: string;
  dateOfBirth: Date;
  department: string;
  program: string;
  semester: number;
  batchSession: string;
  enrollmentDate: Date;
  mobileNumber: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StudentView = {
  id: number;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  gender: Gender;
  dateOfBirth: string;
  department: string;
  program: string;
  semester: number;
  batchSession: string;
  enrollmentDate: string;
  mobileNumber: string;
  email: string;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type FieldErrors = Record<string, string[]>;

export function toStudentView(row: StudentRow): StudentView {
  return {
    id: row.id,
    rollNumber: row.rollNumber,
    fullName: row.fullName,
    fatherName: row.fatherName,
    gender: row.gender as Gender,
    dateOfBirth: utcDateToIsoDate(row.dateOfBirth),
    department: row.department,
    program: row.program,
    semester: row.semester,
    batchSession: row.batchSession,
    enrollmentDate: utcDateToIsoDate(row.enrollmentDate),
    mobileNumber: row.mobileNumber,
    email: row.email,
    status: row.status as StudentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStudentData(input: StudentInput) {
  return {
    rollNumber: input.rollNumber,
    fullName: input.fullName,
    fatherName: input.fatherName,
    gender: input.gender,
    dateOfBirth: isoDateToUtcDate(input.dateOfBirth),
    department: input.department,
    program: input.program,
    semester: input.semester,
    batchSession: input.batchSession,
    enrollmentDate: isoDateToUtcDate(input.enrollmentDate),
    mobileNumber: input.mobileNumber,
    email: input.email.toLowerCase(),
  };
}

export type StudentFilterOptions = {
  query?: string;
  rollNumber?: string;
  department?: string;
  program?: string;
  semester?: number;
};

export async function listStudents(options: string | StudentFilterOptions = "") {
  const opts: StudentFilterOptions = typeof options === "string" ? { query: options } : options;
  const needle = (opts.query ?? "").trim();
  const andClauses: Prisma.StudentWhereInput[] = [];

  if (needle) {
    andClauses.push({
      OR: [
        { rollNumber: { contains: needle } },
        { fullName: { contains: needle } },
        { fatherName: { contains: needle } },
        { department: { contains: needle } },
        { program: { contains: needle } },
        { batchSession: { contains: needle } },
        { mobileNumber: { contains: needle } },
        { email: { contains: needle } },
      ],
    });
  }

  if (opts.rollNumber?.trim()) {
    andClauses.push({
      rollNumber: { contains: opts.rollNumber.trim() },
    });
  }

  if (opts.department?.trim()) {
    andClauses.push({
      department: opts.department.trim(),
    });
  }

  if (opts.program?.trim()) {
    andClauses.push({
      program: opts.program.trim(),
    });
  }

  if (opts.semester && opts.semester > 0) {
    andClauses.push({
      semester: opts.semester,
    });
  }

  const where: Prisma.StudentWhereInput | undefined =
    andClauses.length > 0 ? { AND: andClauses } : undefined;

  const rows = await prisma.student.findMany({
    where,
    orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
  });

  return rows.map(toStudentView);
}

export async function getStudent(id: number) {
  const row = await prisma.student.findUnique({ where: { id } });
  return row ? toStudentView(row) : null;
}

export async function createStudent(input: StudentInput, passwordHash: string) {
  try {
    const row = await prisma.student.create({
      data: {
        ...toStudentData(input),
        passwordHash,
        status: "ACTIVE",
      },
    });
    return { student: toStudentView(row) };
  } catch (error) {
    const errors = uniqueFieldErrors(error);
    if (errors) {
      return { errors };
    }
    throw error;
  }
}

export async function updateStudent(
  id: number,
  input: StudentInput,
  passwordHash?: string,
) {
  try {
    const row = await prisma.student.update({
      where: { id },
      data: {
        ...toStudentData(input),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    return { student: toStudentView(row) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { missing: true as const };
    }

    const errors = uniqueFieldErrors(error);
    if (errors) {
      return { errors };
    }
    throw error;
  }
}

export async function deleteStudent(id: number) {
  try {
    await prisma.student.delete({ where: { id } });
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

export async function updateStudentStatus(id: number, status: StudentStatus) {
  try {
    const row = await prisma.student.update({
      where: { id },
      data: { status },
    });
    return { student: toStudentView(row) };
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

function uniqueFieldErrors(error: unknown): FieldErrors | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  const target = error.meta?.target;
  const text = Array.isArray(target) ? target.join(" ") : String(target ?? "");

  if (text.includes("rollNumber")) {
    return { rollNumber: ["This roll number is already in use."] };
  }

  if (text.includes("email")) {
    return { email: ["This email is already in use."] };
  }

  return { rollNumber: ["This roll number or email is already in use."] };
}
