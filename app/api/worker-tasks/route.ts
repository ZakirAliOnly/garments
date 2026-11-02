import { requireAdmin } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function nextTaskId(tasks: { taskId: string }[]) {
  const nums = tasks.map((t) => {
    const m = t.taskId.match(/TK-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return `TK-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { searchParams } = req.nextUrl;
    const workerId = searchParams.get("workerId");
    const invoiceId = searchParams.get("invoiceId");
    const status = searchParams.get("status"); // "in_progress" | "completed" | null (all)
    const stage = searchParams.get("stage");

    const where: Record<string, unknown> = {};
    if (workerId) where.workerId = workerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;
    if (stage) where.stage = stage;

    const tasks = await prisma.workerTask.findMany({
      where,
      orderBy: { assignedAt: "desc" },
      include: {
        worker: { select: { id: true, workerId: true, name: true, role: true } },
        invoice: { select: { id: true, invNumber: true, deliveryDate: true, items: true } },
      },
    });

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      workerId, invoiceId, itemDescription,
      stage, dueDate, pieceRate, priority, notes,
    } = body;

    if (!workerId) return NextResponse.json({ error: "Worker is required" }, { status: 400 });
    if (!invoiceId) return NextResponse.json({ error: "Invoice is required" }, { status: 400 });
    if (!itemDescription?.trim()) return NextResponse.json({ error: "Item description is required" }, { status: 400 });
    if (!stage) return NextResponse.json({ error: "Stage is required" }, { status: 400 });

    // Validate worker exists and is active
    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    if (worker.status === "inactive") return NextResponse.json({ error: "Cannot assign to inactive worker" }, { status: 400 });

    // Validate invoice exists and is a regular (registered) customer invoice
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.type !== "regular") {
      return NextResponse.json(
        { error: "Only registered customer invoices can be assigned to workers" },
        { status: 400 }
      );
    }

    const allTasks = await prisma.workerTask.findMany({ select: { taskId: true } });
    const taskId = nextTaskId(allTasks);

    const task = await prisma.workerTask.create({
      data: {
        taskId,
        worker: { connect: { id: workerId } },
        invoice: { connect: { id: invoiceId } },
        invoiceNumber: invoice.invNumber,
        customerName: invoice.customerName,
        itemDescription: itemDescription.trim(),
        stage,
        dueDate: dueDate ? new Date(dueDate) : null,
        pieceRate: parseFloat(pieceRate) || 0,
        priority: priority || "normal",
        status: "in_progress",
        notes: notes?.trim() || null,
      },
      include: {
        worker: { select: { id: true, workerId: true, name: true, role: true } },
        invoice: { select: { id: true, invNumber: true, deliveryDate: true, items: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
