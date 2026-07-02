import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { startOfDay, endOfDay, parseISO } from "date-fns";

const rejectionSchema = z.object({
  defectTypeId: z.string().min(1),
  qty: z.number().int().min(1),
  unitCost: z.number().min(0),
  type: z.enum(["REJECTION", "REWORK"]).default("REJECTION"),
});

const createSchema = z.object({
  date: z.string(),
  lineId: z.string().min(1),
  partId: z.string().min(1),
  producedQty: z.number().int().min(0),
  notes: z.string().optional(),
  rejections: z.array(rejectionSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const lineId = searchParams.get("lineId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = startOfDay(parseISO(from));
    if (to) (where.date as Record<string, unknown>).lte = endOfDay(parseISO(to));
  }
  if (lineId) where.lineId = lineId;

  const [entries, total] = await Promise.all([
    prisma.dailyEntry.findMany({
      where,
      include: {
        line: { select: { id: true, name: true } },
        part: { select: { id: true, name: true, unitCost: true } },
        enteredBy: { select: { name: true, email: true } },
        rejections: {
          include: { defectType: { select: { id: true, name: true, category: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dailyEntry.count({ where }),
  ]);

  return NextResponse.json({ entries, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, lineId, partId, producedQty, notes, rejections } = parsed.data;
  const entryDate = startOfDay(parseISO(date));

  // Check for duplicate entry
  const existing = await prisma.dailyEntry.findUnique({
    where: { date_lineId_partId: { date: entryDate, lineId, partId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An entry for this date, line, and part already exists." },
      { status: 409 }
    );
  }

  const entry = await prisma.dailyEntry.create({
    data: {
      date: entryDate,
      lineId,
      partId,
      producedQty,
      notes,
      enteredById: session.user.id,
      rejections: {
        create: rejections.map((r) => ({
          defectTypeId: r.defectTypeId,
          qty: r.qty,
          unitCost: r.unitCost,
          totalCost: r.qty * r.unitCost,
          type: r.type,
        })),
      },
    },
    include: {
      line: true,
      part: true,
      rejections: { include: { defectType: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "DailyEntry",
      entityId: entry.id,
      newValue: { date, lineId, partId, producedQty, rejectionCount: rejections.length },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
