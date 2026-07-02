import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  mergeIntoId: z.string().optional(), // merge duplicate defect types
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { mergeIntoId, ...updateData } = parsed.data;

  // Merge: re-point all rejections from this defect to target, then deactivate this one
  if (mergeIntoId) {
    await prisma.$transaction([
      prisma.rejection.updateMany({
        where: { defectTypeId: params.id },
        data: { defectTypeId: mergeIntoId },
      }),
      prisma.defectType.update({
        where: { id: params.id },
        data: { isActive: false },
      }),
    ]);
    return NextResponse.json({ success: true, merged: true });
  }

  const defectType = await prisma.defectType.update({
    where: { id: params.id },
    data: updateData,
  });
  return NextResponse.json(defectType);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.defectType.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
