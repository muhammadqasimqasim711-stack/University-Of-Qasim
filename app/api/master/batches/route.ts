import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/master/batches - List all batch sessions
export async function GET() {
  try {
    const batches = await prisma.batchSession.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(batches);
  } catch (error) {
    console.error("GET /api/master/batches error:", error);
    return NextResponse.json({ message: "Failed to load batch sessions." }, { status: 500 });
  }
}

// POST /api/master/batches - Create a new batch session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { message: "Batch session name is required.", errors: { name: ["Name is required."] } },
        { status: 400 },
      );
    }

    const existing = await prisma.batchSession.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { message: "A batch session with this name already exists." },
        { status: 409 },
      );
    }

    const batch = await prisma.batchSession.create({ data: { name } });
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("POST /api/master/batches error:", error);
    return NextResponse.json({ message: "Failed to create batch session." }, { status: 500 });
  }
}

// PUT /api/master/batches - Update a batch session
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json({ message: "Batch ID and name are required." }, { status: 400 });
    }

    const existing = await prisma.batchSession.findFirst({
      where: { name: name.trim(), NOT: { id: Number(id) } },
    });
    if (existing) {
      return NextResponse.json({ message: "Another batch session with this name already exists." }, { status: 409 });
    }

    const batch = await prisma.batchSession.update({
      where: { id: Number(id) },
      data: { name: name.trim() },
    });
    return NextResponse.json(batch);
  } catch (error) {
    console.error("PUT /api/master/batches error:", error);
    return NextResponse.json({ message: "Failed to update batch session." }, { status: 500 });
  }
}

// DELETE /api/master/batches - Delete a batch session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Batch ID is required." }, { status: 400 });
    }

    await prisma.batchSession.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Batch session deleted." });
  } catch (error) {
    console.error("DELETE /api/master/batches error:", error);
    return NextResponse.json({ message: "Failed to delete batch session." }, { status: 500 });
  }
}
