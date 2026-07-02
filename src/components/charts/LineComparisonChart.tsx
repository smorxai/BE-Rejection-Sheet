"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface LineData {
  lineName: string;
  rejectionRate: number | null;
  reworkRate: number | null;
  cost: number;
  produced: number;
}

interface LineComparisonChartProps {
  data: LineData[];
  metric: "rate" | "cost" | "volume";
}

export function LineComparisonChart({ data, metric }: LineComparisonChartProps) {
  if (metric === "rate") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="lineName" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n === "rejectionRate" ? "Rejection Rate" : "Rework Rate"]} />
          <Legend formatter={(v) => v === "rejectionRate" ? "Rejection Rate" : "Rework Rate"} />
          <Bar dataKey="rejectionRate" name="rejectionRate" fill="#ef4444" radius={[3, 3, 0, 0]} />
          <Bar dataKey="reworkRate" name="reworkRate" fill="#f97316" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (metric === "cost") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="lineName" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Cost Loss"]} />
          <Bar dataKey="cost" name="Cost Loss" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="lineName" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="produced" name="Produced" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Bar dataKey="rejections" name="Rejections" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
