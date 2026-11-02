import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const task = await prisma.workerTask.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, workerId: true, name: true, role: true } },
        invoice: { select: { id: true, invNumber: true, deliveryDate: true, items: true } },
      },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { workerId, itemDescription, stage, dueDate, pieceRate, priority, status, notes } = body;

    const existing = await prisma.workerTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // If reassigning worker, validate new worker
    if (workerId && workerId !== existing.workerId) {
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });
      if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
      if (worker.status === "inactive") {
        return NextResponse.json({ error: "Cannot assign to inactive worker" }, { status: 400 });
      }
    }

    const completedAt =
      status === "completed" && existing.status !== "completed"
        ? new Date()
        : existing.completedAt ?? undefined;

    const task = await prisma.workerTask.update({
      where: { id },
      data: {
        ...(workerId && { workerId }),
        ...(itemDescription && { itemDescription: itemDescription.trim() }),
        ...(stage && { stage }),
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        ...(pieceRate !== undefined && { pieceRate: parseFloat(pieceRate) || 0 }),
        ...(priority && { priority }),
        ...(status && { status }),
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        ...(completedAt !== undefined && { completedAt }),
      },
      include: {
        worker: { select: { id: true, workerId: true, name: true, role: true } },
        invoice: { select: { id: true, invNumber: true, deliveryDate: true, items: true } },
      },
    });

    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    await prisma.workerTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
