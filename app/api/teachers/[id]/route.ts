import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { passwordForSave } from "@/lib/passwords";
import {
  deleteTeacher,
  getTeacher,
  teacherInputSchema,
  teacherStatusSchema,
  updateTeacher,
  updateTeacherStatus,
} from "@/lib/teachers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
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

  const teacher = await getTeacher(id);
  if (!teacher) {
    return invalidId();
  }

  return NextResponse.json(teacher);
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

  const parsed = teacherInputSchema.safeParse(body);
  const password = passwordForSave(body, false);
  if (!parsed.success || password.error) {
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

  const result = await updateTeacher(id, parsed.data, password.hash);
  if ("missing" in result) {
    return invalidId();
  }
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "The teacher record is not valid.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.teacher);
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

  const parsed = teacherStatusSchema.safeParse(body);
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

  const result = await updateTeacherStatus(id, parsed.data.status);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json(result.teacher);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deleteTeacher(id);
  if ("missing" in result) {
    return invalidId();
  }

  return new NextResponse(null, { status: 204 });
}
