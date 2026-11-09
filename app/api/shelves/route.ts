import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { shelfInputSchema, createShelf, listShelves } from "@/lib/shelves";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const shelves = await listShelves(query);
  return NextResponse.json(shelves);
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

  const result = await createShelf(parsed.data);
  if ("errors" in result) {
    return NextResponse.json(
      {
        message: "Could not create shelf.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result.shelf, { status: 201 });
}
