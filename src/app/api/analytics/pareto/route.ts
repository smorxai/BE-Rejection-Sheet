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
  const lineId = searchParams.get("lineId") ?? undefined;

  const fromDate = startOfDay(parseISO(from));
  const toDate = endOfDay(parseISO(to));

  const rejections = await prisma.rejection.findMany({
    where: {
      type: "REJECTION",
      dailyEntry: {
        date: { gte: fromDate, lte: toDate },
        ...(lineId ? { lineId } : {}),
      },
    },
    include: {
      defectType: { select: { name: true, category: true } },
    },
  });

  const defectMap = new Map<string, { name: string; category?: string | null; count: number; cost: number }>();
  for (const r of rejections) {
    const name = r.defectType.name;
    if (!defectMap.has(name)) {
      defectMap.set(name, { name, category: r.defectType.category, count: 0, cost: 0 });
    }
    const d = defectMap.get(name)!;
    d.count += r.qty;
    d.cost += r.totalCost;
  }

  const sorted = Array.from(defectMap.values()).sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((s, d) => s + d.count, 0);

  let cumulative = 0;
  const pareto = sorted.map((d) => {
    cumulative += d.count;
    return {
      ...d,
      cumPercent: totalCount > 0 ? parseFloat(((cumulative / totalCount) * 100).toFixed(1)) : 0,
    };
  });

  // Also return sorted by cost
  const byCost = Array.from(defectMap.values()).sort((a, b) => b.cost - a.cost);
  let cumCost = 0;
  const totalCost = byCost.reduce((s, d) => s + d.cost, 0);
  const paretoByCost = byCost.map((d) => {
    cumCost += d.cost;
    return {
      ...d,
      cumPercent: totalCost > 0 ? parseFloat(((cumCost / totalCost) * 100).toFixed(1)) : 0,
    };
  });

  return NextResponse.json({ byCount: pareto, byCost: paretoByCost });
}
