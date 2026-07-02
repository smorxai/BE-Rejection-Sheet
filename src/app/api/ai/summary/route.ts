import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateInsight, SYSTEM_PROMPT_ANALYST } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ available: false, summary: null });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];

  const fromDate = startOfDay(parseISO(from));
  const toDate = endOfDay(parseISO(to));

  const entries = await prisma.dailyEntry.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    include: {
      line: { select: { name: true } },
      part: { select: { name: true } },
      rejections: { include: { defectType: { select: { name: true, category: true } } } },
    },
  });

  type Stats = { produced: number; rejections: number; rework: number; cost: number; defects: Record<string, number> };
  const lineStats: Record<string, Stats> = {};
  let totalProduced = 0, totalRejections = 0, totalCost = 0;

  for (const e of entries) {
    const ln = e.line.name;
    if (!lineStats[ln]) lineStats[ln] = { produced: 0, rejections: 0, rework: 0, cost: 0, defects: {} };
    const ls = lineStats[ln];
    ls.produced += e.producedQty;
    totalProduced += e.producedQty;

    for (const r of e.rejections) {
      if (r.type === "REJECTION") {
        ls.rejections += r.qty;
        ls.cost += r.totalCost;
        totalRejections += r.qty;
        totalCost += r.totalCost;
        const dn = r.defectType.name;
        ls.defects[dn] = (ls.defects[dn] ?? 0) + r.qty;
      } else {
        ls.rework += r.qty;
      }
    }
  }

  const overallRate = totalProduced > 0 ? ((totalRejections / totalProduced) * 100).toFixed(2) : "N/A";

  const userPrompt = `Generate a concise daily/period quality summary for plant management.
Period: ${from} to ${to}
Total production: ${totalProduced} units
Total rejections: ${totalRejections} (${overallRate}%)
Total cost loss: ₹${totalCost.toFixed(0)}

Per-line breakdown:
${JSON.stringify(lineStats, null, 2)}

Write 3-4 sentences covering: overall rejection rate, worst-performing line, top defect cause, and one actionable recommendation. Keep it professional and concise. End with a reminder that this is AI-generated and should be verified.`;

  const summary = await generateInsight(SYSTEM_PROMPT_ANALYST, userPrompt);
  return NextResponse.json({ available: true, summary });
}
