import { z } from "zod";
import {
  calendarDateInKarachi,
  isValidIsoDate,
  isoDateToUtcDate,
  utcDateToIsoDate,
} from "@/lib/dates";
import { hashPassword, validateStrongPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { sendRegistrationApprovalEmail } from "@/lib/email";
import type { Gender } from "@/lib/students";
import {
  DEPARTMENTS,
  getProgramsForDepartment,
  isValidFiveYearBatch,
  TEACHER_DESIGNATIONS,
} from "@/lib/academic-data";

export const requestStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export function getFifteenYearsAgoDate(): string {
  const today = calendarDateInKarachi();
  const [year, month, day] = today.split("-").map(Number);
  const cutoffYear = year - 15;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${cutoffYear}-${mm}-${dd}`;
}

export async function generateUniqueNumericRollNumber(): Promise<string> {
  // Generate a random 5 to 6 digit numeric roll number
  for (let attempt = 0; attempt < 50; attempt++) {
    // Generate 6-digit number between 100000 and 999999
    const num = String(Math.floor(100000 + Math.random() * 900000));
    const existingStudent = await prisma.student.findUnique({
      where: { rollNumber: num },
    });
    if (existingStudent) continue;

    const existingReq = await prisma.studentRegistrationRequest.findFirst({
      where: { rollNumber: num, status: "PENDING" },
    });
    if (existingReq) continue;

    return num;
  }
  return String(Date.now()).slice(-6);
}

const requiredText = (label: string, max: number) =>
  z
    .string(`${label} is required.`)
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const studentRequestInputSchema = z
  .object({
    rollNumber: z
      .string("Roll number is required.")
      .trim()
      .min(1, "Roll number is required.")
      .regex(/^\d{5,6}$/, "Roll number must be 5 to 6 numeric digits only."),
    fullName: requiredText("Full name", 120),
    fatherName: requiredText("Father name", 120),
    gender: z.enum(["MALE", "FEMALE"], "Select a gender."),
    dateOfBirth: z.string("Date of birth is required."),
    department: requiredText("Department", 120).refine(
      (dept) => DEPARTMENTS.includes(dept),
      "Please select a valid department from the list.",
    ),
    program: requiredText("Program", 120),
    semester: z
      .number("Semester must be a whole number from 1 to 12.")
      .int("Semester must be a whole number from 1 to 12.")
      .min(1, "Semester must be from 1 to 12.")
      .max(12, "Semester must be from 1 to 12."),
    batchSession: requiredText("Batch/session", 40).refine(
      (batch) => isValidFiveYearBatch(batch),
      "Batch/session must be a 5-year academic batch (e.g. 2024-2029).",
    ),
    enrollmentDate: z.string().optional().default(calendarDateInKarachi()),
    mobileNumber: z
      .string("Mobile number is required.")
      .trim()
      .transform((val) => val.replace(/[\s-]/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^\+923\d{9}$/,
            "Mobile number must be a Pakistan number (+923XXXXXXXXX, 10 digits after +92).",
          ),
      ),
    email: z
      .string("Email is required.")
      .trim()
      .email("Enter a valid email address.")
      .max(120, "Email must be 120 characters or fewer."),
    password: z
      .string("Password is required.")
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer.")
      .refine(
        (pw) => validateStrongPassword(pw) === null,
        {
          message:
            "Password must be at least 8 characters, include uppercase, lowercase, numbers/symbols, and not be an easy password.",
        },
      ),
  })
  .superRefine((value, ctx) => {
    const cutoff = getFifteenYearsAgoDate();
    if (!isValidIsoDate(value.dateOfBirth)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Enter a valid date of birth.",
      });
    } else if (value.dateOfBirth > cutoff) {
      ctx.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: `Student date of birth must be at least 15 years as of current date (born on or before ${cutoff}).`,
      });
    }

    if (value.enrollmentDate && !isValidIsoDate(value.enrollmentDate)) {
      ctx.addIssue({
        code: "custom",
        path: ["enrollmentDate"],
        message: "Enter a valid enrollment date.",
      });
    }

    const validPrograms = getProgramsForDepartment(value.department);
    if (validPrograms.length > 0 && !validPrograms.includes(value.program)) {
      ctx.addIssue({
        code: "custom",
        path: ["program"],
        message: `Program "${value.program}" is not offered under department "${value.department}".`,
      });
    }
  });

export const teacherRequestInputSchema = z
  .object({
    employeeId: z
      .string("Employee ID is required.")
      .trim()
      .min(1, "Employee ID is required.")
      .regex(
        /^EMP-\d{3,}$/i,
        "Employee ID must be in the format EMP-001 (e.g. EMP-001, EMP-1042).",
      )
      .transform((val) => val.toUpperCase()),
    fullName: requiredText("Full name", 120),
    fatherName: requiredText("Father name", 120),
    gender: z.enum(["MALE", "FEMALE"], "Select a gender."),
    dateOfBirth: z.string("Date of birth is required."),
    department: requiredText("Department", 120).refine(
      (dept) => DEPARTMENTS.includes(dept),
      "Please select a valid department from the list.",
    ),
    designation: requiredText("Designation", 120).refine(
      (desig) => TEACHER_DESIGNATIONS.includes(desig as (typeof TEACHER_DESIGNATIONS)[number]),
      "Please select a valid designation from the dropdown.",
    ),
    joiningDate: z.string("Joining date is required."),
    mobileNumber: z
      .string("Mobile number is required.")
      .trim()
      .transform((val) => val.replace(/[\s-]/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^\+923\d{9}$/,
            "Mobile number must be a Pakistan number (+923XXXXXXXXX, 10 digits after +92).",
          ),
      ),
    email: z
      .string("Email is required.")
      .trim()
      .email("Enter a valid email address.")
      .max(120, "Email must be 120 characters or fewer."),
    password: z
      .string("Password is required.")
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer.")
      .refine(
        (pw) => validateStrongPassword(pw) === null,
        {
          message:
            "Password must be at least 8 characters, include uppercase, lowercase, numbers/symbols, and not be an easy password.",
        },
      ),
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

export type StudentRequestInput = z.infer<typeof studentRequestInputSchema>;
export type TeacherRequestInput = z.infer<typeof teacherRequestInputSchema>;

export type StudentRegistrationRequestView = {
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
  status: RequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherRegistrationRequestView = {
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
  status: RequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldErrors = Record<string, string[]>;

export async function submitStudentRequest(
  input: StudentRequestInput,
): Promise<{ success: true; id: number } | { errors: FieldErrors }> {
  const rollNumber = input.rollNumber.trim();
  const email = input.email.trim().toLowerCase();

  // Check if student already registered in system
  const existingStudent = await prisma.student.findFirst({
    where: {
      OR: [{ rollNumber }, { email }],
    },
  });

  if (existingStudent) {
    if (existingStudent.rollNumber.toLowerCase() === rollNumber.toLowerCase()) {
      return { errors: { rollNumber: ["This roll number is already used by another student in the library."] } };
    }
    return { errors: { email: ["This email is already registered."] } };
  }

  // Check if already a pending request
  const existingPending = await prisma.studentRegistrationRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [{ rollNumber }, { email }],
    },
  });

  if (existingPending) {
    if (existingPending.rollNumber.toLowerCase() === rollNumber.toLowerCase()) {
      return {
        errors: {
          rollNumber: ["A registration request with this roll number is already pending review."],
        },
      };
    }
    return {
      errors: {
        email: ["A registration request with this email is already pending review."],
      },
    };
  }

  const passwordError = validateStrongPassword(input.password, true);
  if (passwordError) {
    return { errors: { password: [passwordError] } };
  }

  const passwordHash = hashPassword(input.password);
  const enrollmentDate = input.enrollmentDate || calendarDateInKarachi();

  const row = await prisma.studentRegistrationRequest.create({
    data: {
      rollNumber,
      fullName: input.fullName.trim(),
      fatherName: input.fatherName.trim(),
      gender: input.gender,
      dateOfBirth: isoDateToUtcDate(input.dateOfBirth),
      department: input.department.trim(),
      program: input.program.trim(),
      semester: input.semester,
      batchSession: input.batchSession.trim(),
      enrollmentDate: isoDateToUtcDate(enrollmentDate),
      mobileNumber: input.mobileNumber.trim(),
      email,
      passwordHash,
      status: "PENDING",
    },
  });

  return { success: true, id: row.id };
}

export async function submitTeacherRequest(
  input: TeacherRequestInput,
): Promise<{ success: true; id: number } | { errors: FieldErrors }> {
  const employeeId = input.employeeId.trim();
  const email = input.email.trim().toLowerCase();

  // Check if teacher already registered in system
  const existingTeacher = await prisma.teacher.findFirst({
    where: {
      OR: [{ employeeId }, { email }],
    },
  });

  if (existingTeacher) {
    if (existingTeacher.employeeId.toUpperCase() === employeeId.toUpperCase()) {
      return { errors: { employeeId: ["This Employee ID is already registered by another teacher in the library."] } };
    }
    return { errors: { email: ["This email is already registered."] } };
  }

  // Check if already a pending request
  const existingPending = await prisma.teacherRegistrationRequest.findFirst({
    where: {
      status: "PENDING",
      OR: [{ employeeId }, { email }],
    },
  });

  if (existingPending) {
    if (existingPending.employeeId.toUpperCase() === employeeId.toUpperCase()) {
      return {
        errors: {
          employeeId: ["A registration request with this Employee ID is already pending review."],
        },
      };
    }
    return {
      errors: {
        email: ["A registration request with this email is already pending review."],
      },
    };
  }

  const passwordError = validateStrongPassword(input.password, true);
  if (passwordError) {
    return { errors: { password: [passwordError] } };
  }

  const passwordHash = hashPassword(input.password);

  const row = await prisma.teacherRegistrationRequest.create({
    data: {
      employeeId,
      fullName: input.fullName.trim(),
      fatherName: input.fatherName.trim(),
      gender: input.gender,
      dateOfBirth: isoDateToUtcDate(input.dateOfBirth),
      department: input.department.trim(),
      designation: input.designation.trim(),
      joiningDate: isoDateToUtcDate(input.joiningDate),
      mobileNumber: input.mobileNumber.trim(),
      email,
      passwordHash,
      status: "PENDING",
    },
  });

  return { success: true, id: row.id };
}

export async function listStudentRegistrationRequests(status?: string): Promise<StudentRegistrationRequestView[]> {
  const rows = await prisma.studentRegistrationRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
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
    status: row.status as RequestStatus,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listTeacherRegistrationRequests(status?: string): Promise<TeacherRegistrationRequestView[]> {
  const rows = await prisma.teacherRegistrationRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
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
    status: row.status as RequestStatus,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function approveStudentRegistrationRequest(id: number) {
  const request = await prisma.studentRegistrationRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: "Student registration request not found." };
  }

  if (request.status === "APPROVED") {
    return { error: "This request has already been approved." };
  }

  // Check if roll number or email conflict exists in Student table
  const conflict = await prisma.student.findFirst({
    where: {
      OR: [{ rollNumber: request.rollNumber }, { email: request.email }],
    },
  });

  if (conflict) {
    return {
      error:
        conflict.rollNumber.toLowerCase() === request.rollNumber.toLowerCase()
          ? `Roll number ${request.rollNumber} is already in the student database.`
          : `Email ${request.email} is already registered to another student.`,
    };
  }

  // Create the Student and mark request APPROVED in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        rollNumber: request.rollNumber,
        fullName: request.fullName,
        fatherName: request.fatherName,
        gender: request.gender,
        dateOfBirth: request.dateOfBirth,
        department: request.department,
        program: request.program,
        semester: request.semester,
        batchSession: request.batchSession,
        enrollmentDate: request.enrollmentDate,
        mobileNumber: request.mobileNumber,
        email: request.email,
        passwordHash: request.passwordHash,
        status: "ACTIVE",
      },
    });

    await tx.studentRegistrationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        studentId: student.id,
        message: `Welcome to the library! Your registration has been approved.`,
      },
    });

    return student;
  });

  // Automatically send approval email
  await sendRegistrationApprovalEmail({
    to: request.email,
    fullName: request.fullName,
    role: "Student",
    identifier: request.rollNumber,
    department: request.department,
    programOrDesignation: request.program,
  });

  return { success: true, studentId: result.id };
}

export async function approveTeacherRegistrationRequest(id: number) {
  const request = await prisma.teacherRegistrationRequest.findUnique({
    where: { id },
  });

  if (!request) {
    return { error: "Teacher registration request not found." };
  }

  if (request.status === "APPROVED") {
    return { error: "This request has already been approved." };
  }

  // Check if employee ID or email conflict exists in Teacher table
  const conflict = await prisma.teacher.findFirst({
    where: {
      OR: [{ employeeId: request.employeeId }, { email: request.email }],
    },
  });

  if (conflict) {
    return {
      error:
        conflict.employeeId.toLowerCase() === request.employeeId.toLowerCase()
          ? `Employee ID ${request.employeeId} is already in the teacher database.`
          : `Email ${request.email} is already registered to another teacher.`,
    };
  }

  // Create the Teacher and mark request APPROVED in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.create({
      data: {
        employeeId: request.employeeId,
        fullName: request.fullName,
        fatherName: request.fatherName,
        gender: request.gender,
        dateOfBirth: request.dateOfBirth,
        department: request.department,
        designation: request.designation,
        joiningDate: request.joiningDate,
        mobileNumber: request.mobileNumber,
        email: request.email,
        passwordHash: request.passwordHash,
        status: "ACTIVE",
      },
    });

    await tx.teacherRegistrationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        teacherId: teacher.id,
        message: `Welcome to the library! Your registration has been approved.`,
      },
    });

    return teacher;
  });

  // Automatically send approval email
  await sendRegistrationApprovalEmail({
    to: request.email,
    fullName: request.fullName,
    role: "Teacher",
    identifier: request.employeeId,
    department: request.department,
    programOrDesignation: request.designation,
  });

  return { success: true, teacherId: result.id };
}

export async function rejectRegistrationRequest(type: "student" | "teacher", id: number, reason?: string) {
  if (type === "student") {
    await prisma.studentRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason?.trim() || "Declined by administration.",
        reviewedAt: new Date(),
      },
    });
  } else {
    await prisma.teacherRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason?.trim() || "Declined by administration.",
        reviewedAt: new Date(),
      },
    });
  }

  return { success: true };
}
