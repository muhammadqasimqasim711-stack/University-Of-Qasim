import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { passwordForSave } from "@/lib/passwords";
import {
  createStudent,
  listStudents,
  studentInputSchema,
} from "@/lib/students";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const rollNumber = url.searchParams.get("rollNumber") ?? undefined;
  const department = url.searchParams.get("department") ?? undefined;
  const program = url.searchParams.get("program") ?? undefined;
  const semesterStr = url.searchParams.get("semester");
  const semester = semesterStr && !isNaN(Number(semesterStr)) ? Number(semesterStr) : undefined;

  const students = await listStudents({
    query,
    rollNumber,
    department,
    program,
    semester,
  });
  return NextResponse.json(students);
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

  const parsed = studentInputSchema.safeParse(body);
  const password = passwordForSave(body, true);
  if (!parsed.success || password.error || !password.hash) {
    const flattened = parsed.success
      ? { formErrors: [] as string[], fieldErrors: {} }
      : flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The student record is not valid.",
        errors: {
          ...flattened.fieldErrors,
          ...(password.error ? { password: [password.error] } : {}),
        },
      },
      { status: 400 },
    );
  }

  const result = await createStudent(parsed.data, password.hash);
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "The student record is not valid.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.student, { status: 201 });
}
