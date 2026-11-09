import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { currentRole } from "@/lib/access";
import { readJson, signInRequired } from "@/lib/http";
import {
  listStudentRegistrationRequests,
  listTeacherRegistrationRequests,
  studentRequestInputSchema,
  submitStudentRequest,
  teacherRequestInputSchema,
  submitTeacherRequest,
} from "@/lib/registration-requests";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = (json.body && typeof json.body === "object" ? json.body : {}) as Record<string, unknown>;
  const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";

  if (role === "student") {
    const parsed = studentRequestInputSchema.safeParse(body);
    if (!parsed.success) {
      const flattened = flattenError(parsed.error);
      return NextResponse.json(
        {
          message: flattened.formErrors[0] ?? "Please review and correct the student form errors.",
          errors: flattened.fieldErrors,
        },
        { status: 422 },
      );
    }

    const result = await submitStudentRequest(parsed.data);
    if ("errors" in result) {
      return NextResponse.json(
        {
          message: "Could not submit student registration request.",
          errors: result.errors,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        message: "Your registration request has been submitted to the administration.",
        id: result.id,
      },
      { status: 201 },
    );
  }

  if (role === "teacher") {
    const parsed = teacherRequestInputSchema.safeParse(body);
    if (!parsed.success) {
      const flattened = flattenError(parsed.error);
      return NextResponse.json(
        {
          message: flattened.formErrors[0] ?? "Please review and correct the teacher form errors.",
          errors: flattened.fieldErrors,
        },
        { status: 422 },
      );
    }

    const result = await submitTeacherRequest(parsed.data);
    if ("errors" in result) {
      return NextResponse.json(
        {
          message: "Could not submit teacher registration request.",
          errors: result.errors,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        message: "Your registration request has been submitted to the administration.",
        id: result.id,
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { message: "Invalid role specified. Role must be student or teacher." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  if ((await currentRole()) !== "admin") {
    return signInRequired();
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type")?.trim().toLowerCase();
  const statusParam = searchParams.get("status")?.trim().toUpperCase();
  const status = statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam) ? statusParam : undefined;

  if (type === "teacher") {
    const teachers = await listTeacherRegistrationRequests(status);
    return NextResponse.json(teachers);
  }

  const students = await listStudentRegistrationRequests(status);
  return NextResponse.json(students);
}
