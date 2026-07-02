import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfDay, endOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";

type Granularity = "day" | "week" | "month";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")!;
  const to = searchParams.get("to")!;
  const granularity = (searchParams.get("granularity") ?? "day") as Granularity;
  const lineId = searchParams.get("lineId") ?? undefined;
  const defectTypeId = searchParams.get("defectTypeId") ?? undefined;

  const fromDate = startOfDay(parseISO(from));
  const toDate = endOfDay(parseISO(to));

  const entries = await prisma.dailyEntry.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
      ...(lineId ? { lineId } : {}),
    },
    include: {
      rejections: {
        where: defectTypeId ? { defectTypeId } : {},
      },
    },
    orderBy: { date: "asc" },
  });

  // Build time-series buckets
  type Bucket = { produced: number; rejections: number; rework: number; cost: number };
  const bucketMap = new Map<string, Bucket>();

  // Pre-fill buckets based on granularity
  if (granularity === "day") {
    eachDayOfInterval({ start: fromDate, end: toDate }).forEach((d) => {
      bucketMap.set(format(d, "yyyy-MM-dd"), { produced: 0, rejections: 0, rework: 0, cost: 0 });
    });
  } else if (granularity === "week") {
    eachWeekOfInterval({ start: fromDate, end: toDate }, { weekStartsOn: 1 }).forEach((d) => {
      bucketMap.set(format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"), { produced: 0, rejections: 0, rework: 0, cost: 0 });
    });
  } else {
    eachMonthOfInterval({ start: fromDate, end: toDate }).forEach((d) => {
      bucketMap.set(format(startOfMonth(d), "yyyy-MM-dd"), { produced: 0, rejections: 0, rework: 0, cost: 0 });
    });
  }

  for (const entry of entries) {
    let key: string;
    if (granularity === "day") {
      key = format(entry.date, "yyyy-MM-dd");
    } else if (granularity === "week") {
      key = format(startOfWeek(entry.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    } else {
      key = format(startOfMonth(entry.date), "yyyy-MM-dd");
    }

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { produced: 0, rejections: 0, rework: 0, cost: 0 });
    }
    const bucket = bucketMap.get(key)!;
    bucket.produced += entry.producedQty;
    for (const r of entry.rejections) {
      if (r.type === "REJECTION") { bucket.rejections += r.qty; bucket.cost += r.totalCost; }
      else bucket.rework += r.qty;
    }
  }

  const points = Array.from(bucketMap.entries()).map(([date, b]) => ({
    date,
    produced: b.produced,
    rejections: b.rejections,
    rework: b.rework,
    cost: b.cost,
    rejectionRate: b.produced > 0 ? parseFloat(((b.rejections / b.produced) * 100).toFixed(2)) : null,
  }));

  // 7-point moving average on rejection rate
  const withMovingAvg = points.map((p, i) => {
    const window = points.slice(Math.max(0, i - 6), i + 1);
    const validRates = window.map((w) => w.rejectionRate).filter((r) => r !== null) as number[];
    const movingAvgRate = validRates.length > 0
      ? parseFloat((validRates.reduce((a, b) => a + b, 0) / validRates.length).toFixed(2))
      : null;
    return { ...p, movingAvgRate };
  });

  return NextResponse.json(withMovingAvg);
}
