import { NextResponse } from "next/server";
import { flattenError } from "zod";
import { currentBorrower, currentRole } from "@/lib/access";
import {
  bookRequestSchema,
  createBookRequest,
  listAllRequests,
  listMyRequests,
} from "@/lib/circulation";
import { circulationFailure, readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const role = await currentRole();
  if (role === "admin") {
    return NextResponse.json(await listAllRequests());
  }

  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }
  return NextResponse.json(await listMyRequests(borrower));
}

export async function POST(request: Request) {
  const borrower = await currentBorrower();
  if (!borrower) {
    return signInRequired();
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const parsed = bookRequestSchema.safeParse(json.body);
  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    return NextResponse.json(
      {
        message: flattened.formErrors[0] ?? "The book request is not valid.",
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const created = await createBookRequest(borrower, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return circulationFailure(error) ?? Promise.reject(error);
  }
}
