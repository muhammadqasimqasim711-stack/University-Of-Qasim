import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { passwordForSave } from "@/lib/passwords";
import {
  createTeacher,
  listTeachers,
  teacherInputSchema,
} from "@/lib/teachers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const fullName = url.searchParams.get("fullName") ?? undefined;
  const department = url.searchParams.get("department") ?? undefined;
  const designation = url.searchParams.get("designation") ?? undefined;

  const teachers = await listTeachers({
    query,
    employeeId,
    fullName,
    department,
    designation,
  });
  return NextResponse.json(teachers);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = teacherInputSchema.safeParse(body);
  const password = passwordForSave(body, true);
  if (!parsed.success || password.error || !password.hash) {
    const flattened = parsed.success
      ? { formErrors: [] as string[], fieldErrors: {} }
      : flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The teacher record is not valid.",
        errors: {
          ...flattened.fieldErrors,
          ...(password.error ? { password: [password.error] } : {}),
        },
      },
      { status: 400 },
    );
  }

  const result = await createTeacher(parsed.data, password.hash);
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "The teacher record is not valid.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.teacher, { status: 201 });
}
