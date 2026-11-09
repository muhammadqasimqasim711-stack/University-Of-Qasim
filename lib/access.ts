import { cookies } from "next/headers";
import type { BorrowerRef } from "@/lib/borrower";
import { SESSION_COOKIE, readSessionToken, type Role } from "@/lib/session";

export async function currentRole(): Promise<Role | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;
  return session?.role ?? null;
}

export async function currentBorrower(): Promise<BorrowerRef | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (session?.role === "student" && session.studentId) {
    return { role: "student", studentId: session.studentId };
  }
  if (session?.role === "teacher" && session.teacherId) {
    return { role: "teacher", teacherId: session.teacherId };
  }
  return null;
}
