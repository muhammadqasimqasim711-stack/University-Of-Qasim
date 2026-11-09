import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  shelfInputSchema,
  deleteShelf,
  getShelf,
  updateShelf,
} from "@/lib/shelves";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Shelf not found." }, { status: 404 });
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

  const shelf = await getShelf(id);
  if (!shelf) {
    return invalidId();
  }

  return NextResponse.json(shelf);
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

  const parsed = shelfInputSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The shelf record is not valid.",
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await updateShelf(id, parsed.data);
  if ("missing" in result) {
    return invalidId();
  }
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "Could not update shelf.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.shelf);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deleteShelf(id);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json({ message: "Shelf deleted successfully." });
}
