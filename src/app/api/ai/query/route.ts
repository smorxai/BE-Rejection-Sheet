import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateInsight, SYSTEM_PROMPT_ANALYST } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { z } from "zod";

const schema = z.object({ question: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ available: false, answer: null });
  }

  // Aggregate last 30 days for context
  const to = endOfDay(new Date());
  const from = startOfDay(subDays(new Date(), 30));

  const entries = await prisma.dailyEntry.findMany({
    where: { date: { gte: from, lte: to } },
    include: {
      line: { select: { name: true } },
      part: { select: { name: true } },
      rejections: { include: { defectType: { select: { name: true } } } },
    },
  });

  // Summarize data
  type LineStat = { produced: number; rejections: number; cost: number };
  type DefectStat = { count: number; cost: number };
  const lineStats: Record<string, LineStat> = {};
  const defectStats: Record<string, DefectStat> = {};

  for (const e of entries) {
    const ln = e.line.name;
    if (!lineStats[ln]) lineStats[ln] = { produced: 0, rejections: 0, cost: 0 };
    lineStats[ln].produced += e.producedQty;
    for (const r of e.rejections) {
      if (r.type === "REJECTION") {
        lineStats[ln].rejections += r.qty;
        lineStats[ln].cost += r.totalCost;
        const dn = r.defectType.name;
        if (!defectStats[dn]) defectStats[dn] = { count: 0, cost: 0 };
        defectStats[dn].count += r.qty;
        defectStats[dn].cost += r.totalCost;
      }
    }
  }

  const contextSummary = `
Last 30 days summary:
Lines: ${JSON.stringify(lineStats, null, 2)}
Top defects: ${JSON.stringify(defectStats, null, 2)}
Total entries: ${entries.length}
`;

  const answer = await generateInsight(
    SYSTEM_PROMPT_ANALYST,
    `Context data:\n${contextSummary}\n\nUser question: ${parsed.data.question}`
  );

  return NextResponse.json({ available: true, answer });
}
