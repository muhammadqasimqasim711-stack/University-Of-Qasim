import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/master/semesters - List all semesters
export async function GET() {
  try {
    const semesters = await prisma.semester.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(semesters);
  } catch (error) {
    console.error("GET /api/master/semesters error:", error);
    return NextResponse.json({ message: "Failed to load semesters." }, { status: 500 });
  }
}

// POST /api/master/semesters - Create a new semester
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { message: "Semester name is required.", errors: { name: ["Name is required."] } },
        { status: 400 },
      );
    }

    const existing = await prisma.semester.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { message: "A semester with this name already exists." },
        { status: 409 },
      );
    }

    const semester = await prisma.semester.create({ data: { name } });
    return NextResponse.json(semester, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/semesters error:", error);
    return NextResponse.json({ message: "Failed to create semester." }, { status: 500 });
  }
}

// PUT /api/master/semesters - Update a semester
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json({ message: "Semester ID and name are required." }, { status: 400 });
    }

    const existing = await prisma.semester.findFirst({
      where: { name: name.trim(), NOT: { id: Number(id) } },
    });
    if (existing) {
      return NextResponse.json({ message: "Another semester with this name already exists." }, { status: 409 });
    }

    const semester = await prisma.semester.update({
      where: { id: Number(id) },
      data: { name: name.trim() },
    });
    return NextResponse.json(semester);
  } catch (error) {
    console.error("PUT /api/master/semesters error:", error);
    return NextResponse.json({ message: "Failed to update semester." }, { status: 500 });
  }
}

// DELETE /api/master/semesters - Delete a semester
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Semester ID is required." }, { status: 400 });
    }

    await prisma.semester.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Semester deleted." });
  } catch (error) {
    console.error("DELETE /api/master/semesters error:", error);
    return NextResponse.json({ message: "Failed to delete semester." }, { status: 500 });
  }
}
