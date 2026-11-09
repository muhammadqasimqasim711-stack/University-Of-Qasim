import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/master/designations - List all designations
export async function GET() {
  try {
    const designations = await prisma.designation.findMany({ orderBy: { title: "asc" } });
    return NextResponse.json(designations);
  } catch (error) {
    console.error("GET /api/master/designations error:", error);
    return NextResponse.json({ message: "Failed to load designations." }, { status: 500 });
  }
}

// POST /api/master/designations - Create a new designation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = (body.title || "").trim();

    if (!title) {
      return NextResponse.json(
        { message: "Designation title is required.", errors: { title: ["Title is required."] } },
        { status: 400 },
      );
    }

    const existing = await prisma.designation.findUnique({ where: { title } });
    if (existing) {
      return NextResponse.json(
        { message: "A designation with this title already exists." },
        { status: 409 },
      );
    }

    const designation = await prisma.designation.create({ data: { title } });
    return NextResponse.json(designation, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/designations error:", error);
    return NextResponse.json({ message: "Failed to create designation." }, { status: 500 });
  }
}

// PUT /api/master/designations - Update a designation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title } = body;

    if (!id || !title?.trim()) {
      return NextResponse.json({ message: "Designation ID and title are required." }, { status: 400 });
    }

    const existing = await prisma.designation.findFirst({
      where: { title: title.trim(), NOT: { id: Number(id) } },
    });
    if (existing) {
      return NextResponse.json({ message: "Another designation with this title already exists." }, { status: 409 });
    }

    const designation = await prisma.designation.update({
      where: { id: Number(id) },
      data: { title: title.trim() },
    });
    return NextResponse.json(designation);
  } catch (error) {
    console.error("PUT /api/master/designations error:", error);
    return NextResponse.json({ message: "Failed to update designation." }, { status: 500 });
  }
}

// DELETE /api/master/designations - Delete a designation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Designation ID is required." }, { status: 400 });
    }

    await prisma.designation.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Designation deleted." });
  } catch (error) {
    console.error("DELETE /api/master/designations error:", error);
    return NextResponse.json({ message: "Failed to delete designation." }, { status: 500 });
  }
}
