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

  const rejections = await prisma.rejection.findMany({
    where: {
      type: "REJECTION",
      dailyEntry: { date: { gte: fromDate, lte: toDate } },
    },
    include: {
      defectType: { select: { name: true } },
      dailyEntry: { include: { line: { select: { name: true } } } },
    },
  });

  const cellMap = new Map<string, { lineName: string; defectName: string; count: number; cost: number }>();

  for (const r of rejections) {
    const lineName = r.dailyEntry.line.name;
    const defectName = r.defectType.name;
    const key = `${lineName}::${defectName}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { lineName, defectName, count: 0, cost: 0 });
    }
    const c = cellMap.get(key)!;
    c.count += r.qty;
    c.cost += r.totalCost;
  }

  const cells = Array.from(cellMap.values());
  const lines = [...new Set(cells.map((c) => c.lineName))].sort();
  const defects = [...new Set(cells.map((c) => c.defectName))].sort();

  return NextResponse.json({ cells, lines, defects });
}
