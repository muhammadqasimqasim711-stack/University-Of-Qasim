import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/master/departments - List all departments (with optional programs)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includePrograms = searchParams.get("includePrograms") === "true";

    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: includePrograms ? { programs: { orderBy: { name: "asc" } } } : undefined,
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("GET /api/master/departments error:", error);
    return NextResponse.json({ message: "Failed to load departments." }, { status: 500 });
  }
}

// POST /api/master/departments - Create a new department
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { message: "Department name is required.", errors: { name: ["Name is required."] } },
        { status: 400 },
      );
    }

    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { message: "A department with this name already exists.", errors: { name: ["Already exists."] } },
        { status: 409 },
      );
    }

    const department = await prisma.department.create({ data: { name } });
    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/departments error:", error);
    return NextResponse.json({ message: "Failed to create department." }, { status: 500 });
  }
}

// PUT /api/master/departments - Update a department
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json(
        { message: "Department ID and name are required." },
        { status: 400 },
      );
    }

    const existing = await prisma.department.findFirst({
      where: { name: name.trim(), NOT: { id: Number(id) } },
    });
    if (existing) {
      return NextResponse.json(
        { message: "Another department with this name already exists." },
        { status: 409 },
      );
    }

    const department = await prisma.department.update({
      where: { id: Number(id) },
      data: { name: name.trim() },
    });
    return NextResponse.json(department);
  } catch (error) {
    console.error("PUT /api/master/departments error:", error);
    return NextResponse.json({ message: "Failed to update department." }, { status: 500 });
  }
}

// DELETE /api/master/departments - Delete a department
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Department ID is required." }, { status: 400 });
    }

    await prisma.department.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Department deleted." });
  } catch (error) {
    console.error("DELETE /api/master/departments error:", error);
    return NextResponse.json({ message: "Failed to delete department." }, { status: 500 });
  }
}
