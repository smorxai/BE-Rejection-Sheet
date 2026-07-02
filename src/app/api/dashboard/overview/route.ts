import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfDay, endOfDay, subDays, eachDayOfInterval } from "date-fns";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];

  const fromDate = startOfDay(parseISO(from));
  const toDate = endOfDay(parseISO(to));

  const entries = await prisma.dailyEntry.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    include: {
      line: { select: { name: true } },
      rejections: true,
    },
  });

  let totalProduced = 0;
  let totalRejections = 0;
  let totalRework = 0;
  let totalCost = 0;

  for (const entry of entries) {
    totalProduced += entry.producedQty;
    for (const r of entry.rejections) {
      if (r.type === "REJECTION") {
        totalRejections += r.qty;
        totalCost += r.totalCost;
      } else {
        totalRework += r.qty;
      }
    }
  }

  const rejectionRate = totalProduced > 0 ? (totalRejections / totalProduced) * 100 : null;
  const reworkRate = totalProduced > 0 ? (totalRework / totalProduced) * 100 : null;

  // Per-line breakdown
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

  const byLine = Array.from(lineMap.entries()).map(([lineName, data]) => ({
    lineName,
    ...data,
    rejectionRate: data.produced > 0 ? (data.rejections / data.produced) * 100 : null,
    reworkRate: data.produced > 0 ? (data.rework / data.produced) * 100 : null,
  })).sort((a, b) => (b.rejectionRate ?? 0) - (a.rejectionRate ?? 0));

  // Detect anomalies — look at 30-day rolling window
  const rollingFrom = subDays(fromDate, 30);
  const rollingEntries = await prisma.dailyEntry.findMany({
    where: { date: { gte: rollingFrom, lt: fromDate } },
    include: { rejections: true },
  });

  // Daily rates for the rolling window
  const dayRates: number[] = [];
  const dayMap = new Map<string, { produced: number; rejections: number }>();
  for (const e of rollingEntries) {
    const key = format(e.date, "yyyy-MM-dd");
    if (!dayMap.has(key)) dayMap.set(key, { produced: 0, rejections: 0 });
    const d = dayMap.get(key)!;
    d.produced += e.producedQty;
    d.rejections += e.rejections.filter((r) => r.type === "REJECTION").reduce((s, r) => s + r.qty, 0);
  }
  for (const { produced, rejections } of dayMap.values()) {
    if (produced > 0) dayRates.push((rejections / produced) * 100);
  }

  const anomalies = [];
  if (dayRates.length >= 5) {
    const mean = dayRates.reduce((a, b) => a + b, 0) / dayRates.length;
    const std = Math.sqrt(dayRates.map((r) => Math.pow(r - mean, 2)).reduce((a, b) => a + b, 0) / dayRates.length);
    const threshold = mean + 2 * std;

    if (rejectionRate !== null && rejectionRate > threshold) {
      anomalies.push({ date: from, rejectionRate, threshold, deviation: (rejectionRate - mean) / (std || 1) });
    }
  }

  return NextResponse.json({
    totalProduced,
    totalRejections,
    totalRework,
    totalCost,
    rejectionRate,
    reworkRate,
    byLine,
    anomalies,
    entryCount: entries.length,
  });
}
