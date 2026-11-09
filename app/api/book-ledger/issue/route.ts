import { NextResponse } from "next/server";
import { currentRole } from "@/lib/access";
import { adminIssueBook, CirculationError } from "@/lib/circulation";
import { readJson, signInRequired } from "@/lib/http";

export const dynamic = "force-dynamic";

type IssueItem = {
  bookId: number;
  studentIds: number[];
  teacherIds: number[];
};

type IssueFailure = {
  bookId: number;
  studentId: number | null;
  teacherId: number | null;
  message: string;
};

function idList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = new Set<number>();
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) {
      return null;
    }
    ids.add(item);
  }

  return [...ids];
}

function issueItems(value: unknown): IssueItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: IssueItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const bookId = record.bookId;
    const studentIds = idList(record.studentIds);
    const teacherIds = idList(record.teacherIds);
    if (
      typeof bookId !== "number" ||
      !Number.isInteger(bookId) ||
      bookId < 1 ||
      !studentIds ||
      !teacherIds
    ) {
      return null;
    }
    if (studentIds.length === 0 && teacherIds.length === 0) {
      continue;
    }

    items.push({ bookId, studentIds, teacherIds });
  }

  return items;
}

export async function POST(request: Request) {
  const role = await currentRole();
  if (role !== "admin") {
    return signInRequired();
  }

  const json = await readJson(request);
  if ("error" in json) {
    return json.error;
  }

  const body = json.body as Record<string, unknown> | null;
  const items = issueItems(body?.items);
  if (!items) {
    return NextResponse.json(
      { message: "Select books and the students or teachers who should receive them." },
      { status: 400 },
    );
  }
  if (items.length === 0) {
    return NextResponse.json(
      { message: "Select at least one student or teacher." },
      { status: 400 },
    );
  }

  let issuedCount = 0;
  const failures: IssueFailure[] = [];

  for (const item of items) {
    const targets: Array<{ studentId?: number; teacherId?: number }> = [
      ...item.studentIds.map((studentId) => ({ studentId })),
      ...item.teacherIds.map((teacherId) => ({ teacherId })),
    ];

    for (const target of targets) {
      try {
        await adminIssueBook(item.bookId, target);
        issuedCount += 1;
      } catch (error) {
        failures.push({
          bookId: item.bookId,
          studentId: target.studentId ?? null,
          teacherId: target.teacherId ?? null,
          message:
            error instanceof CirculationError
              ? error.message
              : "Could not issue this book.",
        });
      }
    }
  }

  return NextResponse.json({ issuedCount, failures });
}
