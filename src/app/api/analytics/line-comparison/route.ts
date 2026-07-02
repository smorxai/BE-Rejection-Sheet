import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")!;
  const to = searchParams.get("to")!;

  const fromDate = startOfDay(parseISO(from));
  const toDate = endOfDay(parseISO(to));

  const entries = await prisma.dailyEntry.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    include: {
      line: { select: { name: true } },
      rejections: true,
    },
  });

  const lineMap = new Map<string, { produced: number; rejections: number; rework: number; cost: number }>();
  for (const entry of entries) {
    const name = entry.line.name;
    if (!lineMap.has(name)) lineMap.set(name, { produced: 0, rejections: 0, rework: 0, cost: 0 });
    const l = lineMap.get(name)!;
    l.produced += entry.producedQty;
    for (const r of entry.rejections) {
      if (r.type === "REJECTION") { l.rejections += r.qty; l.cost += r.totalCost; }
      else l.rework += r.qty;
    }
  }

  const comparison = Array.from(lineMap.entries()).map(([lineName, data]) => ({
    lineName,
    ...data,
    rejectionRate: data.produced > 0 ? parseFloat(((data.rejections / data.produced) * 100).toFixed(2)) : null,
    reworkRate: data.produced > 0 ? parseFloat(((data.rework / data.produced) * 100).toFixed(2)) : null,
    costPerUnit: data.produced > 0 ? parseFloat((data.cost / data.produced).toFixed(2)) : null,
  })).sort((a, b) => (b.rejectionRate ?? 0) - (a.rejectionRate ?? 0));

  return NextResponse.json(comparison);
}
