"use client";

import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendDataPoint } from "@/types";

interface TrendChartProps {
  data: TrendDataPoint[];
  metric: "rejectionRate" | "cost" | "volume";
  anomalyThreshold?: number;
}

const COLORS = { rejection: "#ef4444", rework: "#f97316", movingAvg: "#6366f1", cost: "#10b981" };

export function TrendChart({ data, metric, anomalyThreshold }: TrendChartProps) {
  const formatDate = (d: string) => {
    try { return format(parseISO(d), "MMM dd"); } catch { return d; }
  };

  const formatValue = (v: number | null) => {
    if (v === null || v === undefined) return "N/A";
    if (metric === "rejectionRate") return `${v.toFixed(2)}%`;
    if (metric === "cost") return `₹${v.toLocaleString("en-IN")}`;
    return v.toLocaleString("en-IN");
  };

  if (metric === "rejectionRate") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? `${value.toFixed(2)}%` : "N/A",
              name === "rejectionRate" ? "Rejection Rate" : "7-Day Avg",
            ]}
            labelFormatter={formatDate}
          />
          <Legend />
          {anomalyThreshold && (
            <ReferenceLine y={anomalyThreshold} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Threshold", fill: "#ef4444", fontSize: 11 }} />
          )}
          <Area type="monotone" dataKey="rejectionRate" name="Rejection Rate" stroke={COLORS.rejection} fill="#fee2e2" strokeWidth={2} connectNulls />
          <Line type="monotone" dataKey="movingAvgRate" name="7-Day Avg" stroke={COLORS.movingAvg} strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (metric === "cost") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Cost Loss"]} labelFormatter={formatDate} />
          <Area type="monotone" dataKey="cost" name="Cost Loss" stroke={COLORS.cost} fill="#d1fae5" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={formatDate} />
        <Legend />
        <Bar dataKey="produced" name="Produced" fill="#93c5fd" radius={[2, 2, 0, 0]} />
        <Bar dataKey="rejections" name="Rejections" fill={COLORS.rejection} radius={[2, 2, 0, 0]} />
        <Bar dataKey="rework" name="Rework" fill={COLORS.rework} radius={[2, 2, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
