import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateInsight, SYSTEM_PROMPT_ANALYST } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { format } from "date-fns";
import { z } from "zod";

const schema = z.object({
  defectTypeId: z.string(),
  lineId: z.string().optional(),
  spikeDate: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ available: false, analysis: null });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { defectTypeId, lineId, spikeDate } = parsed.data;
  const spikeDateObj = parseISO(spikeDate);

  // Get 30 days of history for this defect
  const from = startOfDay(subDays(spikeDateObj, 30));
  const to = endOfDay(spikeDateObj);

  const [defectType, rejections] = await Promise.all([
    prisma.defectType.findUnique({ where: { id: defectTypeId } }),
    prisma.rejection.findMany({
      where: {
        defectTypeId,
        type: "REJECTION",
        dailyEntry: {
          date: { gte: from, lte: to },
          ...(lineId ? { lineId } : {}),
        },
      },
      include: {
        dailyEntry: {
          include: {
            line: { select: { name: true } },
            part: { select: { name: true } },
          },
        },
      },
      orderBy: { dailyEntry: { date: "asc" } },
    }),
  ]);

  // Daily summary
  type DayData = { date: string; line: string; part: string; qty: number };
  const dailyData: DayData[] = [];
  for (const r of rejections) {
    dailyData.push({
      date: format(r.dailyEntry.date, "yyyy-MM-dd"),
      line: r.dailyEntry.line.name,
      part: r.dailyEntry.part.name,
      qty: r.qty,
    });
  }

  const userPrompt = `Analyze a spike in "${defectType?.name}" defects on ${spikeDate}.

Historical data (last 30 days):
${JSON.stringify(dailyData, null, 2)}

Provide:
1. A brief summary of the trend (2-3 sentences)
2. 3-5 possible root causes based on the pattern (consider: machine setup, material batch, operator, shift patterns, part type)
3. Recommended immediate actions
4. What additional data would help confirm the root cause

Keep each section brief. Note this is AI-generated and should be verified by the production team.`;

  const analysis = await generateInsight(SYSTEM_PROMPT_ANALYST, userPrompt);
  return NextResponse.json({ available: true, analysis, defectName: defectType?.name });
}
