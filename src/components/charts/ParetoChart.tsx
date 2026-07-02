"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface ParetoItem {
  name: string;
  category?: string | null;
  count: number;
  cost: number;
  cumPercent: number;
}

interface ParetoChartProps {
  data: ParetoItem[];
  mode: "count" | "cost";
}

export function ParetoChart({ data, mode }: ParetoChartProps) {
  const displayed = data.slice(0, 12);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={displayed} margin={{ top: 10, right: 40, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          interval={0}
          height={70}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === "Cumulative %") return [`${value}%`, name];
            if (name === "Cost Loss") return [`₹${Number(value).toLocaleString("en-IN")}`, name];
            return [value, name];
          }}
        />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey={mode === "count" ? "count" : "cost"}
          name={mode === "count" ? "Rejection Count" : "Cost Loss"}
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumPercent"
          name="Cumulative %"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: "#ef4444", r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
