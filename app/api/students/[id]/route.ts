import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { passwordForSave } from "@/lib/passwords";
import {
  deleteStudent,
  getStudent,
  studentInputSchema,
  studentStatusSchema,
  updateStudent,
  updateStudentStatus,
} from "@/lib/students";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Student not found." }, { status: 404 });
}

async function readId(context: RouteContext) {
  const { id } = await context.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

export async function GET(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const student = await getStudent(id);
  if (!student) {
    return invalidId();
  }

  return NextResponse.json(student);
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

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
  const password = passwordForSave(body, false);
  if (!parsed.success || password.error) {
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

  const result = await updateStudent(id, parsed.data, password.hash);
  if ("missing" in result) {
    return invalidId();
  }
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "The student record is not valid.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.student);
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = studentStatusSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The status is not valid.",
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await updateStudentStatus(id, parsed.data.status);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json(result.student);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deleteStudent(id);
  if ("missing" in result) {
    return invalidId();
  }

  return new NextResponse(null, { status: 204 });
}
