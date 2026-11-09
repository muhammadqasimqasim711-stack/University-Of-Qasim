import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/master/programs - List programs, optionally filtered by departmentId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    const programs = await prisma.program.findMany({
      where: departmentId ? { departmentId: Number(departmentId) } : undefined,
      orderBy: { name: "asc" },
      include: { department: true },
    });

    return NextResponse.json(programs);
  } catch (error) {
    console.error("GET /api/master/programs error:", error);
    return NextResponse.json({ message: "Failed to load programs." }, { status: 500 });
  }
}

// POST /api/master/programs - Create a new program
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const departmentId = Number(body.departmentId);

    if (!name) {
      return NextResponse.json(
        { message: "Program name is required.", errors: { name: ["Name is required."] } },
        { status: 400 },
      );
    }
    if (!departmentId) {
      return NextResponse.json(
        { message: "Department is required.", errors: { departmentId: ["Department is required."] } },
        { status: 400 },
      );
    }

    const existing = await prisma.program.findUnique({
      where: { name_departmentId: { name, departmentId } },
    });
    if (existing) {
      return NextResponse.json(
        { message: "This program already exists in the selected department." },
        { status: 409 },
      );
    }

    const program = await prisma.program.create({
      data: { name, departmentId },
      include: { department: true },
    });
    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/programs error:", error);
    return NextResponse.json({ message: "Failed to create program." }, { status: 500 });
  }
}

// PUT /api/master/programs - Update a program
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, departmentId } = body;

    if (!id || !name?.trim() || !departmentId) {
      return NextResponse.json(
        { message: "Program ID, name, and department are required." },
        { status: 400 },
      );
    }

    const program = await prisma.program.update({
      where: { id: Number(id) },
      data: { name: name.trim(), departmentId: Number(departmentId) },
      include: { department: true },
    });
    return NextResponse.json(program);
  } catch (error) {
    console.error("PUT /api/master/programs error:", error);
    return NextResponse.json({ message: "Failed to update program." }, { status: 500 });
  }
}

// DELETE /api/master/programs - Delete a program
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Program ID is required." }, { status: 400 });
    }

    await prisma.program.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Program deleted." });
  } catch (error) {
    console.error("DELETE /api/master/programs error:", error);
    return NextResponse.json({ message: "Failed to delete program." }, { status: 500 });
  }
}
