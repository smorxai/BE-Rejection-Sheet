"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays, startOfWeek, startOfMonth, subMonths } from "date-fns";
import {
  TrendingDown, TrendingUp, DollarSign, Factory, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LineComparisonChart } from "@/components/charts/LineComparisonChart";
import { formatCurrency, formatNumber, formatPercent, type Period, PERIOD_LABELS } from "@/lib/utils";

type PeriodData = {
  totalProduced: number;
  totalRejections: number;
  totalRework: number;
  totalCost: number;
  rejectionRate: number | null;
  reworkRate: number | null;
  byLine: Array<{
    lineName: string;
    produced: number;
    rejections: number;
    rework: number;
    cost: number;
    rejectionRate: number | null;
    reworkRate: number | null;
  }>;
  anomalies: Array<{ date: string; rejectionRate: number; threshold: number }>;
  entryCount: number;
};

function getPeriodDates(period: Period): { from: string; to: string } {
  const today = new Date();
  const toStr = format(today, "yyyy-MM-dd");
  const periods: Record<Period, Date> = {
    today: today,
    week: startOfWeek(today, { weekStartsOn: 1 }),
    month: startOfMonth(today),
    "3m": subMonths(today, 3),
    "6m": subMonths(today, 6),
    "9m": subMonths(today, 9),
    "12m": subMonths(today, 12),
  };
  return { from: format(periods[period], "yyyy-MM-dd"), to: toStr };
}

function MetricCard({
  title, value, sub, icon: Icon, color, loading,
}: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={`rounded-full p-2 ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodDates(period);
    try {
      const res = await fetch(`/api/dashboard/overview?from=${from}&to=${to}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchAiSummary = useCallback(async () => {
    setAiLoading(true);
    const { from, to } = getPeriodDates(period);
    const res = await fetch(`/api/ai/summary?from=${from}&to=${to}`);
    const json = await res.json();
    setAiSummary(json.available ? json.summary : null);
    setAiLoading(false);
  }, [period]);

  useEffect(() => {
    fetchData();
    setAiSummary(null);
  }, [fetchData]);

  const periods: Period[] = ["today", "week", "month", "3m", "6m", "9m", "12m"];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
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
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Anomaly alerts */}
      {data?.anomalies && data.anomalies.length > 0 && (
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Anomaly Detected</p>
            {data.anomalies.map((a, i) => (
              <p key={i} className="text-sm text-red-700">
                Rejection rate {formatPercent(a.rejectionRate)} exceeds threshold {formatPercent(a.threshold)} — statistical spike detected.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Produced"
          value={loading ? "—" : formatNumber(data?.totalProduced ?? 0)}
          sub="units"
          icon={Factory}
          color="bg-blue-500"
          loading={loading}
        />
        <MetricCard
          title="Rejection Rate"
          value={loading ? "—" : formatPercent(data?.rejectionRate)}
          sub={loading ? "" : `${formatNumber(data?.totalRejections ?? 0)} rejected`}
          icon={TrendingDown}
          color="bg-red-500"
          loading={loading}
        />
        <MetricCard
          title="Rework Rate"
          value={loading ? "—" : formatPercent(data?.reworkRate)}
          sub={loading ? "" : `${formatNumber(data?.totalRework ?? 0)} reworked`}
          icon={TrendingUp}
          color="bg-orange-500"
          loading={loading}
        />
        <MetricCard
          title="Cost Loss"
          value={loading ? "—" : formatCurrency(data?.totalCost ?? 0)}
          sub="rejection cost"
          icon={DollarSign}
          color="bg-green-500"
          loading={loading}
        />
      </div>

      {/* Line comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rejection Rate by Line</CardTitle>
            <CardDescription>{PERIOD_LABELS[period]}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : data?.byLine && data.byLine.length > 0 ? (
              <LineComparisonChart data={data.byLine} metric="rate" />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Loss by Line</CardTitle>
            <CardDescription>{PERIOD_LABELS[period]}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : data?.byLine && data.byLine.length > 0 ? (
              <LineComparisonChart data={data.byLine} metric="cost" />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No data for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line table */}
      {!loading && data?.byLine && data.byLine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3">Line</th>
                    <th className="text-right py-2 px-3">Produced</th>
                    <th className="text-right py-2 px-3">Rejections</th>
                    <th className="text-right py-2 px-3">Rej Rate</th>
                    <th className="text-right py-2 px-3">Rework</th>
                    <th className="text-right py-2 px-3">Cost Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byLine.map((l) => (
                    <tr key={l.lineName} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{l.lineName}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(l.produced)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(l.rejections)}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge
                          variant={l.rejectionRate !== null && l.rejectionRate > 5 ? "destructive" : "success"}
                          className="font-mono"
                        >
                          {formatPercent(l.rejectionRate)}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right">{formatNumber(l.rework)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>AI Quality Summary</CardTitle>
            <CardDescription>AI-generated narrative — always verify with domain experts</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAiSummary} disabled={aiLoading}>
            {aiLoading ? "Generating..." : "Generate Summary"}
          </Button>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : aiSummary ? (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-blue-50 rounded-lg p-4 border border-blue-200">
              <Badge variant="outline" className="mb-2 text-blue-700 border-blue-300">AI Generated</Badge>
              <p className="mt-1">{aiSummary}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click "Generate Summary" to get an AI-powered narrative of this period's quality performance.
              {!process.env.NEXT_PUBLIC_AI_ENABLED && " (Requires OPENAI_API_KEY)"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
