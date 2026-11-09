import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  authorInputSchema,
  deleteAuthor,
  getAuthor,
  updateAuthor,
} from "@/lib/authors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Author not found." }, { status: 404 });
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

  const author = await getAuthor(id);
  if (!author) {
    return invalidId();
  }

  return NextResponse.json(author);
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

  const parsed = authorInputSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The author record is not valid.",
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await updateAuthor(id, parsed.data);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json(result.author);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deleteAuthor(id);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json({ message: "Author deleted successfully." });
}
