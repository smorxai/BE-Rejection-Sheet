"use client";

interface HeatmapCell {
  lineName: string;
  defectName: string;
  count: number;
  cost: number;
}

interface DefectHeatmapProps {
  cells: HeatmapCell[];
  lines: string[];
  defects: string[];
  metric: "count" | "cost";
}

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#f3f4f6";
  const intensity = value / max;
  if (intensity < 0.25) return "#fee2e2";
  if (intensity < 0.5) return "#fca5a5";
  if (intensity < 0.75) return "#f87171";
  return "#ef4444";
}

export function DefectHeatmap({ cells, lines, defects, metric }: DefectHeatmapProps) {
  const cellMap = new Map<string, HeatmapCell>();
  for (const c of cells) {
    cellMap.set(`${c.lineName}::${c.defectName}`, c);
  }

  const values = cells.map((c) => (metric === "count" ? c.count : c.cost));
  const maxVal = Math.max(...values, 1);

  if (lines.length === 0 || defects.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-12">No data for selected period.</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-muted-foreground bg-gray-50 border border-gray-200 min-w-[100px]">
              Line ↓ / Defect →
            </th>
            {defects.map((d) => (
              <th
                key={d}
                className="p-2 font-medium text-muted-foreground bg-gray-50 border border-gray-200 min-w-[80px] whitespace-nowrap"
                style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", height: 80 }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line}>
              <td className="p-2 font-medium border border-gray-200 bg-gray-50 whitespace-nowrap">{line}</td>
              {defects.map((defect) => {
                const cell = cellMap.get(`${line}::${defect}`);
                const value = cell ? (metric === "count" ? cell.count : cell.cost) : 0;
                const bg = getColor(value, maxVal);
                return (
                  <td
                    key={defect}
                    className="p-2 text-center border border-gray-200 font-medium transition-colors"
                    style={{ backgroundColor: bg, color: value > 0 ? "#1e293b" : "#9ca3af" }}
                    title={`${line} × ${defect}: ${metric === "cost" ? `₹${value.toLocaleString("en-IN")}` : value}`}
                  >
                    {value > 0 ? (metric === "cost" ? `₹${(value / 1000).toFixed(1)}K` : value) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>Low</span>
        {["#fee2e2", "#fca5a5", "#f87171", "#ef4444"].map((c) => (
          <div key={c} className="w-6 h-4 rounded" style={{ backgroundColor: c }} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}
