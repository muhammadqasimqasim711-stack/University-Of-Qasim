import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { readJson, signInRequired } from "@/lib/http";
import {
  approveStudentRegistrationRequest,
  approveTeacherRegistrationRequest,
} from "@/lib/registration-requests";

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
  const type = typeof body.type === "string" ? body.type.trim().toLowerCase() : "student";

  if (type === "teacher") {
    const result = await approveTeacherRegistrationRequest(requestId);
    if ("error" in result) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    return NextResponse.json({
      message: "Teacher registration approved and email notification sent successfully.",
      teacherId: result.teacherId,
    });
  }

  const result = await approveStudentRegistrationRequest(requestId);
  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: "Student registration approved and email notification sent successfully.",
    studentId: result.studentId,
  });
}
