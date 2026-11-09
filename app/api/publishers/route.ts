import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  publisherInputSchema,
  createPublisher,
  listPublishers,
} from "@/lib/publishers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const publishers = await listPublishers(query);
  return NextResponse.json(publishers);
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
    const result = await createPublisher(parsed.data);
    return NextResponse.json(result.publisher, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "A publisher with this name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Failed to create publisher." },
      { status: 500 },
    );
  }
}
