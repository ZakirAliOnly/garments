import { requireModuleAccess } from "@/lib/auth/require-admin";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function nextWorkerId(workers: { workerId: string }[]) {
  const nums = workers.map((w) => {
    const m = w.workerId.match(/WRK-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return `WRK-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
    const status = req.nextUrl.searchParams.get("status"); // "active" | "leave" | "inactive" | null (all)
    const where = status ? { status } : {};

    const workers = await prisma.worker.findMany({
      where,
      orderBy: { workerId: "asc" },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          where: { status: "in_progress" },
          select: { id: true },
        },
      },
    });

    return NextResponse.json(workers);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch workers" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireModuleAccess("workers");
  if (denied) return denied;
  try {
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

    const allWorkers = await prisma.worker.findMany({
      select: { workerId: true },
    });
    const workerId = nextWorkerId(allWorkers);

    const worker = await prisma.worker.create({
      data: {
        workerId,
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

    return NextResponse.json(worker, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create worker" },
      { status: 500 },
    );
  }
}
