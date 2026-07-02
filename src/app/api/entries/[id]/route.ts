import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  producedQty: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  rejections: z.array(z.object({
    id: z.string().optional(),
    defectTypeId: z.string().min(1),
    qty: z.number().int().min(1),
    unitCost: z.number().min(0),
    type: z.enum(["REJECTION", "REWORK"]).default("REJECTION"),
  })).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: params.id },
    include: {
      line: true,
      part: true,
      enteredBy: { select: { name: true, email: true } },
      rejections: { include: { defectType: true } },
    },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.dailyEntry.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only admin or the person who created it
  if (session.user.role !== "ADMIN" && existing.enteredById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rejections, ...entryData } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.dailyEntry.update({
      where: { id: params.id },
      data: entryData,
    });

    if (rejections) {
      // Replace all rejections
      await tx.rejection.deleteMany({ where: { dailyEntryId: params.id } });
      await tx.rejection.createMany({
        data: rejections.map((r) => ({
          dailyEntryId: params.id,
          defectTypeId: r.defectTypeId,
          qty: r.qty,
          unitCost: r.unitCost,
          totalCost: r.qty * r.unitCost,
          type: r.type,
        })),
      });
    }

    return entry;
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "DailyEntry",
      entityId: params.id,
      oldValue: { producedQty: existing.producedQty },
      newValue: entryData,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.dailyEntry.delete({ where: { id: params.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DELETE",
      entityType: "DailyEntry",
      entityId: params.id,
    },
  });

  return NextResponse.json({ success: true });
}
