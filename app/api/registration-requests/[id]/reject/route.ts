import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { readJson, signInRequired } from "@/lib/http";
import { rejectRegistrationRequest } from "@/lib/registration-requests";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if ((await currentRole()) !== "admin") {
    return signInRequired();
  }

  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return NextResponse.json({ message: "Invalid request ID." }, { status: 400 });
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = (json.body && typeof json.body === "object" ? json.body : {}) as Record<string, unknown>;
  const type = typeof body.type === "string" && body.type.trim().toLowerCase() === "teacher" ? "teacher" : "student";
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  await rejectRegistrationRequest(type, requestId, reason);

  return NextResponse.json({
    message: "Registration request has been declined.",
  });
}
