import { NextResponse } from "next/server";
import {
  accountForAdmin,
  accountForCredentials,
  accountForStudent,
  accountForTeacher,
} from "@/lib/accounts";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  type SessionIdentity,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const json = await request.json();
    if (json && typeof json === "object") {
      body = json as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
  const rollNumber =
    typeof body.rollNumber === "string"
      ? body.rollNumber.trim()
      : typeof body.username === "string"
        ? body.username.trim()
        : "";
  const employeeId =
    typeof body.employeeId === "string"
      ? body.employeeId.trim()
      : typeof body.username === "string"
        ? body.username.trim()
        : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  let account: SessionIdentity | null = null;

  if (role === "student") {
    if (!rollNumber || !email || !password) {
      return NextResponse.json(
        { message: "Roll number, email, and password are all required." },
        { status: 400 },
      );
    }
    account = await accountForStudent(rollNumber, email, password);
    if (!account) {
      return NextResponse.json(
        { message: "Invalid roll number, email, or password." },
        { status: 401 },
      );
    }
  } else if (role === "teacher") {
    if (!employeeId || !email || !password) {
      return NextResponse.json(
        { message: "Employee ID, email, and password are all required." },
        { status: 400 },
      );
    }
    account = await accountForTeacher(employeeId, email, password);
    if (!account) {
      return NextResponse.json(
        { message: "Invalid employee ID, email, or password." },
        { status: 401 },
      );
    }
  } else if (role === "admin") {
    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required." },
        { status: 400 },
      );
    }
    account = await accountForAdmin(username, password);
    if (!account) {
      return NextResponse.json(
        { message: "The username or password is not correct." },
        { status: 401 },
      );
    }
  } else {
    // Fallback if role is not specified
    if (typeof body.rollNumber === "string" && body.rollNumber.trim()) {
      account = await accountForStudent(body.rollNumber.trim(), email, password);
      if (!account) {
        return NextResponse.json(
          { message: "Invalid roll number, email, or password." },
          { status: 401 },
        );
      }
    } else if (typeof body.employeeId === "string" && body.employeeId.trim()) {
      account = await accountForTeacher(body.employeeId.trim(), email, password);
      if (!account) {
        return NextResponse.json(
          { message: "Invalid employee ID, email, or password." },
          { status: 401 },
        );
      }
    } else {
      account = await accountForCredentials(username, password, email);
      if (!account) {
        return NextResponse.json(
          { message: "The credentials entered are not correct." },
          { status: 401 },
        );
      }
    }
  }

  const response = NextResponse.json({ role: account.role });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(account),
    sessionCookieOptions(),
  );
  return response;
}

