import { NextResponse } from "next/server";
import { currentBorrower, currentRole } from "@/lib/access";
import {
  dashboardSummary,
  getProfile,
  listMyLoans,
  profileContactSchema,
  updateProfile,
} from "@/lib/circulation";
import { getConfiguration } from "@/lib/configuration";
import { hashPassword, passwordFieldError, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { getStudent } from "@/lib/students";
import { getTeacher } from "@/lib/teachers";
import type { BorrowerRef } from "@/lib/borrower";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await currentRole();
  let borrower = await currentBorrower();
  let isAdminPreview = false;

  const url = new URL(request.url);
  const previewRole = url.searchParams.get("role");
  const previewId = url.searchParams.get("id");

  // Admin access or inspection
  if (role === "admin") {
    if (previewRole === "teacher") {
      const teacherId = previewId ? parseInt(previewId, 10) : (await prisma.teacher.findFirst({ select: { id: true } }))?.id;
      if (teacherId) {
        borrower = { role: "teacher", teacherId };
        isAdminPreview = true;
      }
    } else {
      // Default to student if requested or fallback for admin preview
      const studentId = previewId ? parseInt(previewId, 10) : (await prisma.student.findFirst({ select: { id: true } }))?.id;
      if (studentId) {
        borrower = { role: "student", studentId };
        isAdminPreview = true;
      } else {
        // Try teacher if no students exist
        const teacherId = (await prisma.teacher.findFirst({ select: { id: true } }))?.id;
        if (teacherId) {
          borrower = { role: "teacher", teacherId };
          isAdminPreview = true;
        }
      }
    }
  }

  if (!borrower) {
    return NextResponse.json(
      { message: "Authentication required to view profile." },
      { status: 401 },
    );
  }

  const [profile, config, loans] = await Promise.all([
    getProfile(borrower),
    getConfiguration(),
    listMyLoans(borrower),
  ]);

  if (!profile) {
    return NextResponse.json(
      { message: "Profile record not found." },
      { status: 404 },
    );
  }

  const maxBooks =
    borrower.role === "student"
      ? config.maxBooksPerStudent
      : config.maxBooksPerTeacher;

  const activeLoansCount = loans.length;
  const remainingQuota = Math.max(0, maxBooks - activeLoansCount);
  const overdueCount = loans.filter((l) => l.overdue).length;

  return NextResponse.json({
    role: borrower.role,
    profile,
    quota: {
      maxBooks,
      activeLoansCount,
      remainingQuota,
      overdueCount,
    },
    activeLoans: loans,
    libraryConfig: {
      libraryName: config.libraryName,
      contactEmail: config.contactEmail,
      borrowingPeriodDays: config.borrowingPeriodDays,
    },
    isAdminPreview,
    adminInfo:
      role === "admin"
        ? {
            username: process.env.ADMIN_USERNAME || "Admin",
            role: "Administrator",
            libraryName: config.libraryName,
            contactEmail: config.contactEmail,
          }
        : undefined,
  });
}

export async function PATCH(request: Request) {
  const role = await currentRole();
  let borrower = await currentBorrower();

  // Allow admin to specify target member if updating via admin preview
  if (role === "admin" && !borrower) {
    const url = new URL(request.url);
    const targetRole = url.searchParams.get("role");
    const targetId = url.searchParams.get("id");
    if (targetRole === "teacher" && targetId) {
      borrower = { role: "teacher", teacherId: parseInt(targetId, 10) };
    } else if (targetRole === "student" && targetId) {
      borrower = { role: "student", studentId: parseInt(targetId, 10) };
    }
  }

  if (!borrower) {
    return NextResponse.json(
      { message: "Authentication required to update profile." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newPassword = typeof body.password === "string" ? body.password.trim() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword.trim() : "";

  // Validate contact info
  const contactValidation = profileContactSchema.safeParse({ mobileNumber, email });
  if (!contactValidation.success) {
    const firstIssue = contactValidation.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message ?? "Invalid contact details." },
      { status: 400 },
    );
  }

  // Cross-check email uniqueness across both Students & Teachers
  if (borrower.role === "student") {
    const studentWithEmail = await prisma.student.findFirst({
      where: { email, id: { not: borrower.studentId } },
      select: { id: true },
    });
    const teacherWithEmail = await prisma.teacher.findFirst({
      where: { email },
      select: { id: true },
    });
    if (studentWithEmail || teacherWithEmail) {
      return NextResponse.json(
        { message: "This email address is already in use by another library member." },
        { status: 400 },
      );
    }
  } else {
    const teacherWithEmail = await prisma.teacher.findFirst({
      where: { email, id: { not: borrower.teacherId } },
      select: { id: true },
    });
    const studentWithEmail = await prisma.student.findFirst({
      where: { email },
      select: { id: true },
    });
    if (teacherWithEmail || studentWithEmail) {
      return NextResponse.json(
        { message: "This email address is already in use by another library member." },
        { status: 400 },
      );
    }
  }

  let nextPasswordHash: string | undefined = undefined;

  // Handle password update if supplied
  if (newPassword) {
    const passwordError = passwordFieldError(newPassword, true);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    // If member already has an existing password, verify current password
    if (borrower.role === "student") {
      const studentRecord = await prisma.student.findUnique({
        where: { id: borrower.studentId },
        select: { passwordHash: true },
      });
      if (studentRecord?.passwordHash && !verifyPassword(currentPassword, studentRecord.passwordHash)) {
        return NextResponse.json(
          { message: "Current password is incorrect." },
          { status: 400 },
        );
      }
    } else {
      const teacherRecord = await prisma.teacher.findUnique({
        where: { id: borrower.teacherId },
        select: { passwordHash: true },
      });
      if (teacherRecord?.passwordHash && !verifyPassword(currentPassword, teacherRecord.passwordHash)) {
        return NextResponse.json(
          { message: "Current password is incorrect." },
          { status: 400 },
        );
      }
    }

    nextPasswordHash = hashPassword(newPassword);
  }

  try {
    const updated = await updateProfile(
      borrower,
      { mobileNumber, email },
      nextPasswordHash,
    );

    return NextResponse.json({
      message: "Profile updated successfully.",
      profile: updated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update profile.";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
