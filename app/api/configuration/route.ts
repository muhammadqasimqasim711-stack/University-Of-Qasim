import { NextResponse } from "next/server";
import { flattenError } from "zod";
import {
  configurationInputSchema,
  getConfiguration,
  updateConfiguration,
} from "@/lib/configuration";
import { hashPassword, passwordFieldError } from "@/lib/passwords";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuration = await getConfiguration();
  return NextResponse.json(configuration);
}

export async function PUT(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : "";
  const parsed = configurationInputSchema.safeParse(body);

  if (!parsed.success) {
    const flattened = flattenError(parsed.error);
    const firstErrorMessage =
      flattened.formErrors[0] ??
      Object.values(flattened.fieldErrors)[0]?.[0] ??
      "The configuration is not valid.";
    return NextResponse.json(
      {
        message: firstErrorMessage,
        errors: flattened.fieldErrors,
      },
      { status: 400 },
    );
  }

  let adminPasswordHash: string | undefined;
  if (password.trim()) {
    const passwordError = passwordFieldError(password, true);
    if (passwordError) {
      return NextResponse.json(
        {
          message: passwordError,
          errors: { password: [passwordError] },
        },
        { status: 400 },
      );
    }
    adminPasswordHash = hashPassword(password);
  }

  const configuration = await updateConfiguration(parsed.data, adminPasswordHash);
  return NextResponse.json(configuration);
}
