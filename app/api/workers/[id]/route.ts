import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
    const { id } = await params;
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { assignedAt: "desc" },
          include: {
            invoice: { select: { invNumber: true, deliveryDate: true } },
          },
        },
      },
    });
    if (!worker)
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    return NextResponse.json(worker);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch worker" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      role,
      phone,
      cnic,
      salaryType,
      rate,
      joinDate,
      status,
      notes,
      extraHoursRate,
    } = body;

    if (
      !Number.isFinite(Number(rate || 0)) ||
      Number(rate || 0) < 0 ||
      !Number.isFinite(Number(extraHoursRate || 0)) ||
      Number(extraHoursRate || 0) < 0
    )
      return NextResponse.json(
        { error: "Wages and extra-hours rate must be non-negative numbers" },
        { status: 400 },
      );
    if (!name?.trim())
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!role?.trim())
      return NextResponse.json({ error: "Role is required" }, { status: 400 });

    const worker = await prisma.worker.update({
      where: { id },
      data: {
        name: name.trim(),
        role: role.trim(),
        phone: phone?.trim() || null,
        cnic: cnic?.trim() || null,
        salaryType: salaryType || "monthly",
        extraHoursRate: Number(extraHoursRate || 0),
        rate: parseFloat(rate) || 0,
        joinDate: joinDate ? new Date(joinDate) : null,
        status: status || "active",
        notes: notes?.trim() || null,
      },
    });
    return NextResponse.json(worker);
  } catch {
    return NextResponse.json(
      { error: "Failed to update worker" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
    const { id } = await params;
    if ((await prisma.workerPayroll.count({ where: { workerId: id } })) > 0)
      return NextResponse.json(
        {
          error:
            "Workers with payroll history cannot be deleted. Mark them inactive instead.",
        },
        { status: 400 },
      );
    // Prevent deletion if worker has active tasks
    const activeTasks = await prisma.workerTask.count({
      where: { workerId: id, status: "in_progress" },
    });
    if (activeTasks > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete worker with active tasks. Complete or reassign tasks first.",
        },
        { status: 400 },
      );
    }
    await prisma.worker.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete worker" },
      { status: 500 },
    );
  }
}
