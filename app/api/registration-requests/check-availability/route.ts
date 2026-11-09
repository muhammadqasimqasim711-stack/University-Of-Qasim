import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.trim().toLowerCase();
  const value = searchParams.get("value")?.trim();

  if (!type || !value) {
    return NextResponse.json({ available: false, message: "Type and value required." }, { status: 400 });
  }

  if (type === "student") {
    // Must be 5 to 6 digits numeric
    if (!/^\d{5,6}$/.test(value)) {
      return NextResponse.json({
        available: false,
        message: "Roll number must be 5 to 6 numeric digits only.",
      });
    }

    const existingStudent = await prisma.student.findFirst({
      where: { rollNumber: value },
    });
    if (existingStudent) {
      return NextResponse.json({
        available: false,
        message: "This roll number is already used by another student in the library.",
      });
    }

    const existingPending = await prisma.studentRegistrationRequest.findFirst({
      where: { rollNumber: value, status: "PENDING" },
    });
    if (existingPending) {
      return NextResponse.json({
        available: false,
        message: "A registration request with this roll number is already pending review.",
      });
    }

    return NextResponse.json({ available: true, message: "Roll number is available." });
  }

  if (type === "teacher") {
    const empId = value.toUpperCase();
    if (!/^EMP-\d{3,}$/i.test(empId)) {
      return NextResponse.json({
        available: false,
        message: "Employee ID must be in format EMP-001 (e.g. EMP-001, EMP-1042).",
      });
    }

    const existingTeacher = await prisma.teacher.findFirst({
      where: { employeeId: empId },
    });
    if (existingTeacher) {
      return NextResponse.json({
        available: false,
        message: "This Employee ID is already registered by another teacher in the library.",
      });
    }

    const existingPending = await prisma.teacherRegistrationRequest.findFirst({
      where: { employeeId: empId, status: "PENDING" },
    });
    if (existingPending) {
      return NextResponse.json({
        available: false,
        message: "A registration request with this Employee ID is already pending review.",
      });
    }

    return NextResponse.json({ available: true, message: "Employee ID is available." });
  }

  return NextResponse.json({ available: false, message: "Unknown type." }, { status: 400 });
}
