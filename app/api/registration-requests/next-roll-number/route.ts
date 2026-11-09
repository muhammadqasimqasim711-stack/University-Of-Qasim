import { NextResponse } from "next/server";
import { calendarDateInKarachi } from "@/lib/dates";
import {
  generateUniqueNumericRollNumber,
  getFifteenYearsAgoDate,
} from "@/lib/registration-requests";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rollNumber = await generateUniqueNumericRollNumber();
    const enrollmentDate = calendarDateInKarachi();
    const maxDateOfBirth = getFifteenYearsAgoDate();

    return NextResponse.json({
      rollNumber,
      enrollmentDate,
      maxDateOfBirth,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not generate roll number." },
      { status: 500 },
    );
  }
}
