"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays, startOfWeek, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/charts/TrendChart";
import { ParetoChart } from "@/components/charts/ParetoChart";
import { LineComparisonChart } from "@/components/charts/LineComparisonChart";
import { DefectHeatmap } from "@/components/charts/DefectHeatmap";
import { PERIOD_LABELS, type Period } from "@/lib/utils";
import type { TrendDataPoint } from "@/types";
import type { Line } from "@/types";

type Granularity = "day" | "week" | "month";

function getPeriodDates(period: Period): { from: string; to: string } {
  const today = new Date();
  const toStr = format(today, "yyyy-MM-dd");
  const fromMap: Record<Period, Date> = {
    today: today,
    week: startOfWeek(today, { weekStartsOn: 1 }),
    month: startOfMonth(today),
    "3m": subMonths(today, 3),
    "6m": subMonths(today, 6),
    "9m": subMonths(today, 9),
    "12m": subMonths(today, 12),
  };
  return { from: format(fromMap[period], "yyyy-MM-dd"), to: toStr };
}

function getDefaultGranularity(period: Period): Granularity {
  if (period === "today" || period === "week") return "day";
  if (period === "month" || period === "3m") return "day";
  return "week";
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [lineFilter, setLineFilter] = useState<string>("all");
  const [lines, setLines] = useState<Line[]>([]);

  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [pareto, setPareto] = useState<{ byCount: unknown[]; byCost: unknown[] } | null>(null);
  const [comparison, setComparison] = useState<unknown[]>([]);
  const [heatmap, setHeatmap] = useState<{ cells: unknown[]; lines: string[]; defects: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lines").then((r) => r.json()).then(setLines);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodDates(period);
    const lineParam = lineFilter !== "all" ? `&lineId=${lineFilter}` : "";

    const [t, p, c, h] = await Promise.all([
      fetch(`/api/analytics/trends?from=${from}&to=${to}&granularity=${granularity}${lineParam}`).then((r) => r.json()),
      fetch(`/api/analytics/pareto?from=${from}&to=${to}${lineParam}`).then((r) => r.json()),
      fetch(`/api/analytics/line-comparison?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/analytics/heatmap?from=${from}&to=${to}`).then((r) => r.json()),
    ]);

    setTrends(t);
    setPareto(p);
    setComparison(c);
    setHeatmap(h);
    setLoading(false);
  }, [period, granularity, lineFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const periods: Period[] = ["today", "week", "month", "3m", "6m", "9m", "12m"];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-wrap gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setGranularity(getDefaultGranularity(p)); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lines</SelectItem>
            {lines.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Trend charts */}
      <Card>
        <CardHeader>
          <CardTitle>Rejection Rate Trend</CardTitle>
          <CardDescription>Actual rate with 7-point moving average</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-72 w-full" /> : <TrendChart data={trends} metric="rejectionRate" />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost Loss Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : <TrendChart data={trends} metric="cost" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production vs Rejections Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : <TrendChart data={trends} metric="volume" />}
          </CardContent>
        </Card>
      </div>

      {/* Pareto */}
      <Card>
        <CardHeader>
          <CardTitle>Pareto Analysis — Top Defect Causes</CardTitle>
          <CardDescription>80/20 view of defect frequency and cost impact</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="count">
            <TabsList className="mb-4">
              <TabsTrigger value="count">By Count</TabsTrigger>
              <TabsTrigger value="cost">By Cost</TabsTrigger>
            </TabsList>
            <TabsContent value="count">
              {loading ? (
                <Skeleton className="h-80 w-full" />
              ) : pareto?.byCount && (pareto.byCount as unknown[]).length > 0 ? (
                <ParetoChart
                  data={(pareto.byCount as Array<{ name: string; category?: string | null; count: number; cost: number; cumPercent: number }>)}
                  mode="count"
                />
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </TabsContent>
            <TabsContent value="cost">
              {loading ? (
                <Skeleton className="h-80 w-full" />
              ) : pareto?.byCost && (pareto.byCost as unknown[]).length > 0 ? (
                <ParetoChart
                  data={(pareto.byCost as Array<{ name: string; category?: string | null; count: number; cost: number; cumPercent: number }>)}
                  mode="cost"
                />
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Line comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Line-vs-Line Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rate">
            <TabsList className="mb-4">
              <TabsTrigger value="rate">Rejection Rates</TabsTrigger>
              <TabsTrigger value="cost">Cost Loss</TabsTrigger>
              <TabsTrigger value="volume">Volume</TabsTrigger>
            </TabsList>
            {(["rate", "cost", "volume"] as const).map((m) => (
              <TabsContent key={m} value={m}>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (comparison as unknown[]).length > 0 ? (
                  <LineComparisonChart data={comparison as Parameters<typeof LineComparisonChart>[0]["data"]} metric={m} />
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Defect Intensity Heatmap</CardTitle>
          <CardDescription>Line × Defect type — darker = more rejections</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="count">
            <TabsList className="mb-4">
              <TabsTrigger value="count">By Count</TabsTrigger>
              <TabsTrigger value="cost">By Cost</TabsTrigger>
            </TabsList>
            {(["count", "cost"] as const).map((m) => (
              <TabsContent key={m} value={m}>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : heatmap ? (
                  <DefectHeatmap
                    cells={heatmap.cells as Parameters<typeof DefectHeatmap>[0]["cells"]}
                    lines={heatmap.lines}
                    defects={heatmap.defects}
                    metric={m}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
