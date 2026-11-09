import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [departments, semesters, batches, designations] = await Promise.all([
      prisma.department.findMany({
        orderBy: { name: "asc" },
        include: {
          programs: {
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.semester.findMany({
        orderBy: { id: "asc" },
      }),
      prisma.batchSession.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.designation.findMany({
        orderBy: { title: "asc" },
      }),
    ]);

    const academicStructure: Record<string, string[]> = {};
    for (const d of departments) {
      academicStructure[d.name] = d.programs.map((p) => p.name);
    }

    return NextResponse.json({
      departments: departments.map((d) => d.name),
      academicStructure,
      semesters: semesters.map((s) => s.name),
      batches: batches.map((b) => b.name),
      designations: designations.map((d) => d.title),
    });
  } catch (error) {
    console.error("GET /api/master/all error:", error);
    return NextResponse.json(
      { message: "Failed to load master configuration data." },
      { status: 500 }
    );
  }
}
