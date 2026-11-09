import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { authorInputSchema, createAuthor, listAuthors } from "@/lib/authors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const authors = await listAuthors(query);
  return NextResponse.json(authors);
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

  const result = await createAuthor(parsed.data);
  return NextResponse.json(result.author, { status: 201 });
}
