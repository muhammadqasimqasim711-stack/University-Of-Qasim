import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  publisherInputSchema,
  deletePublisher,
  getPublisher,
  updatePublisher,
} from "@/lib/publishers";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function invalidId() {
  return NextResponse.json({ message: "Publisher not found." }, { status: 404 });
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

  const publisher = await getPublisher(id);
  if (!publisher) {
    return invalidId();
  }

  return NextResponse.json(publisher);
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

  const parsed = publisherInputSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The publisher record is not valid.",
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await updatePublisher(id, parsed.data);
    if ("missing" in result) {
      return invalidId();
    }
    return NextResponse.json(result.publisher);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "A publisher with this name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Failed to update publisher." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const id = await readId(context);
  if (id === null) {
    return invalidId();
  }

  const result = await deletePublisher(id);
  if ("missing" in result) {
    return invalidId();
  }

  return NextResponse.json({ message: "Publisher deleted successfully." });
}
