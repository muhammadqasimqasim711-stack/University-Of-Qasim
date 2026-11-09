import { NextResponse } from "next/server";
import { CirculationError } from "@/lib/circulation";

export function circulationFailure(error: unknown) {
  if (error instanceof CirculationError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return null;
}

export async function readJson(request: Request) {
  try {
    return { body: (await request.json()) as unknown };
  } catch {
    return { error: NextResponse.json({ message: "Request body must be JSON." }, { status: 400 }) };
  }
}

export function signInRequired() {
  return NextResponse.json({ message: "Sign in required." }, { status: 401 });
}
