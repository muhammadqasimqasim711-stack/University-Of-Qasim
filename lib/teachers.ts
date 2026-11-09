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
export const teacherStatuses = ["ACTIVE", "SUSPENDED"] as const;

export type Gender = (typeof genders)[number];
export type TeacherStatus = (typeof teacherStatuses)[number];

const requiredText = (label: string, max: number) =>
  z
    .string(`${label} is required.`)
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const teacherInputSchema = z
  .object({
    employeeId: requiredText("Employee ID", 30),
    fullName: requiredText("Full name", 120),
    fatherName: requiredText("Father name", 120),
    gender: z.enum(genders, "Select a gender."),
    dateOfBirth: z.string("Date of birth is required."),
    department: requiredText("Department", 120),
    designation: requiredText("Designation", 120),
    joiningDate: z.string("Joining date is required."),
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

    if (!isValidIsoDate(value.joiningDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["joiningDate"],
        message: "Enter a valid joining date.",
      });
    } else if (
      isValidIsoDate(value.dateOfBirth) &&
      value.joiningDate < value.dateOfBirth
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["joiningDate"],
        message: "Joining date must be on or after the date of birth.",
      });
    }
  });

export const teacherStatusSchema = z.object({
  status: z.enum(teacherStatuses, "Status must be active or suspended."),
});

export type TeacherInput = z.infer<typeof teacherInputSchema>;

type TeacherRow = {
  id: number;
  employeeId: string;
  fullName: string;
  fatherName: string;
  gender: string;
  dateOfBirth: Date;
  department: string;
  designation: string;
  joiningDate: Date;
  mobileNumber: string;
  email: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TeacherView = {
  id: number;
  employeeId: string;
  fullName: string;
  fatherName: string;
  gender: Gender;
  dateOfBirth: string;
  department: string;
  designation: string;
  joiningDate: string;
  mobileNumber: string;
  email: string;
  status: TeacherStatus;
  createdAt: string;
  updatedAt: string;
};

export type FieldErrors = Record<string, string[]>;

export function toTeacherView(row: TeacherRow): TeacherView {
  return {
    id: row.id,
    employeeId: row.employeeId,
    fullName: row.fullName,
    fatherName: row.fatherName,
    gender: row.gender as Gender,
    dateOfBirth: utcDateToIsoDate(row.dateOfBirth),
    department: row.department,
    designation: row.designation,
    joiningDate: utcDateToIsoDate(row.joiningDate),
    mobileNumber: row.mobileNumber,
    email: row.email,
    status: row.status as TeacherStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTeacherData(input: TeacherInput) {
  return {
    employeeId: input.employeeId,
    fullName: input.fullName,
    fatherName: input.fatherName,
    gender: input.gender,
    dateOfBirth: isoDateToUtcDate(input.dateOfBirth),
    department: input.department,
    designation: input.designation,
    joiningDate: isoDateToUtcDate(input.joiningDate),
    mobileNumber: input.mobileNumber,
    email: input.email.toLowerCase(),
  };
}

export type TeacherFilterOptions = {
  query?: string;
  employeeId?: string;
  fullName?: string;
  department?: string;
  designation?: string;
};

export async function listTeachers(options: string | TeacherFilterOptions = "") {
  const opts: TeacherFilterOptions = typeof options === "string" ? { query: options } : options;
  const needle = (opts.query ?? "").trim();
  const andClauses: Prisma.TeacherWhereInput[] = [];

  if (needle) {
    andClauses.push({
      OR: [
        { employeeId: { contains: needle } },
        { fullName: { contains: needle } },
        { fatherName: { contains: needle } },
        { department: { contains: needle } },
        { designation: { contains: needle } },
        { mobileNumber: { contains: needle } },
        { email: { contains: needle } },
      ],
    });
  }

  if (opts.employeeId?.trim()) {
    andClauses.push({
      employeeId: { contains: opts.employeeId.trim() },
    });
  }

  if (opts.fullName?.trim()) {
    andClauses.push({
      fullName: { contains: opts.fullName.trim() },
    });
  }

  if (opts.department?.trim()) {
    andClauses.push({
      department: opts.department.trim(),
    });
  }

  if (opts.designation?.trim()) {
    andClauses.push({
      designation: opts.designation.trim(),
    });
  }

  const where: Prisma.TeacherWhereInput | undefined =
    andClauses.length > 0 ? { AND: andClauses } : undefined;

  const rows = await prisma.teacher.findMany({
    where,
    orderBy: [{ joiningDate: "desc" }, { id: "desc" }],
  });

  return rows.map(toTeacherView);
}

export async function getTeacher(id: number) {
  const row = await prisma.teacher.findUnique({ where: { id } });
  return row ? toTeacherView(row) : null;
}

export async function createTeacher(input: TeacherInput, passwordHash: string) {
  try {
    const row = await prisma.teacher.create({
      data: {
        ...toTeacherData(input),
        passwordHash,
        status: "ACTIVE",
      },
    });
    return { teacher: toTeacherView(row) };
  } catch (error) {
    const errors = uniqueFieldErrors(error);
    if (errors) {
      return { errors };
    }
    throw error;
  }
}

export async function updateTeacher(
  id: number,
  input: TeacherInput,
  passwordHash?: string,
) {
  try {
    const row = await prisma.teacher.update({
      where: { id },
      data: {
        ...toTeacherData(input),
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    return { teacher: toTeacherView(row) };
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

export async function deleteTeacher(id: number) {
  try {
    await prisma.teacher.delete({ where: { id } });
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

export async function updateTeacherStatus(id: number, status: TeacherStatus) {
  try {
    const row = await prisma.teacher.update({
      where: { id },
      data: { status },
    });
    return { teacher: toTeacherView(row) };
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

  if (text.includes("employeeId")) {
    return { employeeId: ["This employee ID is already in use."] };
  }

  if (text.includes("email")) {
    return { email: ["This email is already in use."] };
  }

  return { employeeId: ["This employee ID or email is already in use."] };
}
