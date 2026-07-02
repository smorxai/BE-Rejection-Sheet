"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, startOfWeek, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Download, Eye, Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPercent, PERIOD_LABELS, type Period } from "@/lib/utils";
import type { Line, DefectType } from "@/types";

interface RejectionRow {
  id: string;
  defectType: { name: string; category: string | null };
  defectTypeId: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  type: "REJECTION" | "REWORK";
}

interface Entry {
  id: string;
  date: string;
  line: { name: string };
  part: { name: string; unitCost: number };
  producedQty: number;
  notes: string | null;
  enteredBy: { name: string | null; email: string };
  rejections: RejectionRow[];
}

type TabType = "rejections" | "rework";

function getPeriodDates(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = format(today, "yyyy-MM-dd");
  const fromMap: Record<Period, string> = {
    today: format(today, "yyyy-MM-dd"),
    week: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    month: format(startOfMonth(today), "yyyy-MM-dd"),
    "3m": format(subMonths(today, 3), "yyyy-MM-dd"),
    "6m": format(subMonths(today, 6), "yyyy-MM-dd"),
    "9m": format(subMonths(today, 9), "yyyy-MM-dd"),
    "12m": format(subMonths(today, 12), "yyyy-MM-dd"),
  };
  return { from: fromMap[period], to };
}

function entryTotals(rejections: RejectionRow[]) {
  let rejQty = 0, rewQty = 0, cost = 0;
  for (const r of rejections) {
    if (r.type === "REJECTION") { rejQty += r.qty; cost += r.totalCost; }
    else rewQty += r.qty;
  }
  return { rejQty, rewQty, cost };
}

// ── Detail dialog ─────────────────────────────────────────────────────────────
function DetailDialog({ entry, open, onClose, onEdit }: {
  entry: Entry | null; open: boolean; onClose: () => void; onEdit: () => void;
}) {
  if (!entry) return null;
  const { rejQty, rewQty, cost } = entryTotals(entry.rejections);
  const rejRate = entry.producedQty > 0 ? (rejQty / entry.producedQty) * 100 : null;
  const rejections = entry.rejections.filter((r) => r.type === "REJECTION");
  const reworks = entry.rejections.filter((r) => r.type === "REWORK");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entry — {format(parseISO(entry.date), "dd MMM yyyy")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { label: "Line", value: entry.line.name },
            { label: "Part", value: entry.part.name },
            { label: "Produced", value: entry.producedQty.toLocaleString("en-IN") },
            { label: "Rej Rate", value: formatPercent(rejRate) },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded p-3">
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="font-semibold">{s.value}</div>
            </div>
          ))}
        </div>

        {rejections.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-red-700">Rejections</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-1.5 pr-3">Defect</th>
                  <th className="text-right py-1.5 pr-3">Qty</th>
                  <th className="text-right py-1.5 pr-3">Unit Cost</th>
                  <th className="text-right py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {rejections.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{r.defectType.name}</td>
                    <td className="py-1.5 pr-3 text-right">{r.qty}</td>
                    <td className="py-1.5 pr-3 text-right">₹{r.unitCost}</td>
                    <td className="py-1.5 text-right font-medium">{formatCurrency(r.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-red-700 border-t">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right pr-3">{rejQty}</td>
                  <td />
                  <td className="pt-2 text-right">{formatCurrency(cost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {reworks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-orange-700">Rework</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-1.5 pr-3">Defect</th>
                  <th className="text-right py-1.5">Qty</th>
                </tr>
              </thead>
              <tbody>
                {reworks.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{r.defectType.name}</td>
                    <td className="py-1.5 text-right">{r.qty}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-orange-700 border-t">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{rewQty}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {entry.notes && (
          <p className="text-sm bg-blue-50 rounded p-3">
            <span className="font-medium">Notes: </span>{entry.notes}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Entered by {entry.enteredBy.name ?? entry.enteredBy.email}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────
interface EditRow {
  _key: string;
  defectTypeId: string;
  qty: string;
  unitCost: string;
  type: "REJECTION" | "REWORK";
}

function EditDialog({ entry, open, onClose, onSaved, defectTypes }: {
  entry: Entry | null; open: boolean; onClose: () => void;
  onSaved: () => void; defectTypes: DefectType[];
}) {
  const { toast } = useToast();
  const [producedQty, setProducedQty] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setProducedQty(String(entry.producedQty));
    setNotes(entry.notes ?? "");
    setRows(entry.rejections.map((r) => ({
      _key: r.id,
      defectTypeId: r.defectTypeId,
      qty: String(r.qty),
      unitCost: String(r.unitCost),
      type: r.type,
    })));
  }, [entry]);

  if (!entry) return null;

  const addRow = (type: "REJECTION" | "REWORK") =>
    setRows((p) => [...p, {
      _key: crypto.randomUUID(),
      defectTypeId: "",
      qty: "",
      unitCost: type === "REJECTION" ? String(entry.part.unitCost || "") : "0",
      type,
    }]);

  const removeRow = (key: string) => setRows((p) => p.filter((r) => r._key !== key));
  const updateRow = (key: string, field: keyof EditRow, value: string) =>
    setRows((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const save = async () => {
    const validRows = rows.filter((r) => r.defectTypeId && r.qty && parseInt(r.qty) > 0);
    if (validRows.length === 0) {
      toast({ title: "Add at least one defect row", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedQty: parseInt(producedQty) || 0,
          notes: notes || null,
          rejections: validRows.map((r) => ({
            defectTypeId: r.defectTypeId,
            qty: parseInt(r.qty),
            unitCost: parseFloat(r.unitCost) || 0,
            type: r.type,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Entry updated" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const rejRows = rows.filter((r) => r.type === "REJECTION");
  const rewRows = rows.filter((r) => r.type === "REWORK");
  const totalCost = rejRows.reduce((s, r) => s + (parseInt(r.qty) || 0) * (parseFloat(r.unitCost) || 0), 0);
  const rejRate = parseInt(producedQty) > 0
    ? (rejRows.reduce((s, r) => s + (parseInt(r.qty) || 0), 0) / parseInt(producedQty)) * 100 : null;

  const RowSection = ({ sectionRows, type, label }: { sectionRows: EditRow[]; type: "REJECTION" | "REWORK"; label: string }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-semibold ${type === "REJECTION" ? "text-red-700" : "text-orange-700"}`}>{label}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => addRow(type)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
        </Button>
      </div>
      {sectionRows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No {label.toLowerCase()} rows.</p>
      ) : (
        <div className="space-y-2">
          {sectionRows.map((row) => {
            const rowTotal = (parseInt(row.qty) || 0) * (parseFloat(row.unitCost) || 0);
            return (
              <div key={row._key} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-5">
                  <Select value={row.defectTypeId} onValueChange={(v) => updateRow(row._key, "defectTypeId", v)}>
                    <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Defect..." /></SelectTrigger>
                    <SelectContent>
                      {defectTypes.filter((d) => d.isActive).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="1" value={row.qty}
                    onChange={(e) => updateRow(row._key, "qty", e.target.value)}
                    placeholder="Qty" className="h-9 text-sm" />
                </div>
                {type === "REJECTION" && (
                  <div className="col-span-4 sm:col-span-2">
                    <Input type="number" min="0" step="0.01" value={row.unitCost}
                      onChange={(e) => updateRow(row._key, "unitCost", e.target.value)}
                      placeholder="₹" className="h-9 text-sm" />
                  </div>
                )}
                {type === "REJECTION" && (
                  <div className="col-span-3 sm:col-span-2 text-sm font-medium text-center">
                    {rowTotal > 0 ? formatCurrency(rowTotal) : "—"}
                  </div>
                )}
                <div className={`${type === "REJECTION" ? "col-span-1" : "col-span-4 sm:col-span-5"} flex justify-end`}>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500"
                    onClick={() => removeRow(row._key)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit — {format(parseISO(entry.date), "dd MMM yyyy")} · {entry.line.name} · {entry.part.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Produced Qty</Label>
              <Input type="number" min="0" value={producedQty}
                onChange={(e) => setProducedQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <RowSection sectionRows={rejRows} type="REJECTION" label="Rejections" />
          <RowSection sectionRows={rewRows} type="REWORK" label="Rework" />

          <div className="flex items-center gap-4 text-sm bg-gray-50 rounded p-3">
            <span className="text-muted-foreground">Cost Loss:</span>
            <span className="font-bold text-red-600">{formatCurrency(totalCost)}</span>
            <span className="text-muted-foreground ml-4">Rej Rate:</span>
            <span className={`font-bold ${rejRate !== null && rejRate > 5 ? "text-red-600" : "text-green-600"}`}>
              {formatPercent(rejRate)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PERIODS: Period[] = ["today", "week", "month", "3m", "6m", "9m", "12m"];
const PAGE_SIZE = 25;

export default function EntriesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("rejections");
  const [period, setPeriod] = useState<Period>("month");
  const [lineFilter, setLineFilter] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/lines").then((r) => r.json()),
      fetch("/api/defect-types").then((r) => r.json()),
    ]).then(([l, d]) => { setLines(l); setDefectTypes(d); });
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { from, to } = getPeriodDates(period);
    const lineParam = lineFilter !== "all" ? `&lineId=${lineFilter}` : "";
    const res = await fetch(`/api/entries?from=${from}&to=${to}${lineParam}&page=${page}&limit=${PAGE_SIZE}`);
    const json = await res.json();
    setEntries(json.entries ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [period, lineFilter, page]);

  useEffect(() => { setPage(1); }, [period, lineFilter, activeTab]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: "Entry deleted" }); fetchEntries(); }
    else toast({ title: "Delete failed — admin only", variant: "destructive" });
  };

  // Split by type for the two tables
  const rejectionEntries = entries.filter((e) => e.rejections.some((r) => r.type === "REJECTION"));
  const reworkEntries = entries.filter((e) => e.rejections.some((r) => r.type === "REWORK"));
  const displayEntries = activeTab === "rejections" ? rejectionEntries : reworkEntries;

  const rejSummary = rejectionEntries.reduce(
    (acc, e) => {
      const { rejQty, cost } = entryTotals(e.rejections);
      acc.produced += e.producedQty; acc.rejections += rejQty; acc.cost += cost;
      return acc;
    },
    { produced: 0, rejections: 0, cost: 0 }
  );
  const rewSummary = reworkEntries.reduce(
    (acc, e) => {
      const { rewQty } = entryTotals(e.rejections);
      acc.produced += e.producedQty; acc.rework += rewQty;
      return acc;
    },
    { produced: 0, rework: 0 }
  );

  const rejRate = rejSummary.produced > 0 ? (rejSummary.rejections / rejSummary.produced) * 100 : null;
  const rewRate = rewSummary.produced > 0 ? (rewSummary.rework / rewSummary.produced) * 100 : null;

  const exportCSV = () => {
    const { from, to } = getPeriodDates(period);
    if (activeTab === "rejections") {
      const rows = [
        ["Date", "Line", "Part", "Produced", "Rejected", "Rej Rate %", "Cost (INR)", "Top Defect"],
        ...rejectionEntries.map((e) => {
          const { rejQty, cost } = entryTotals(e.rejections);
          const rate = e.producedQty > 0 ? ((rejQty / e.producedQty) * 100).toFixed(2) : "N/A";
          const top = e.rejections.filter((r) => r.type === "REJECTION").sort((a, b) => b.qty - a.qty)[0];
          return [format(parseISO(e.date), "yyyy-MM-dd"), e.line.name, e.part.name,
            e.producedQty, rejQty, rate, cost.toFixed(0), top?.defectType.name ?? ""];
        }),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rejections_${from}_${to}.csv`;
      a.click();
    } else {
      const rows = [
        ["Date", "Line", "Part", "Produced", "Rework Qty", "Rework Rate %", "Top Rework Defect"],
        ...reworkEntries.map((e) => {
          const { rewQty } = entryTotals(e.rejections);
          const rate = e.producedQty > 0 ? ((rewQty / e.producedQty) * 100).toFixed(2) : "N/A";
          const top = e.rejections.filter((r) => r.type === "REWORK").sort((a, b) => b.qty - a.qty)[0];
          return [format(parseISO(e.date), "yyyy-MM-dd"), e.line.name, e.part.name,
            e.producedQty, rewQty, rate, top?.defectType.name ?? ""];
        }),
      ];
      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rework_${from}_${to}.csv`;
      a.click();
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("rejections")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "rejections"
              ? "border-red-500 text-red-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Rejections
        </button>
        <button
          onClick={() => setActiveTab("rework")}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "rework"
              ? "border-orange-500 text-orange-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Rework
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lines</SelectItem>
            {lines.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={displayEntries.length === 0}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {activeTab === "rejections" ? rejectionEntries.length : reworkEntries.length} entries
        </span>
      </div>

      {/* Summary strip */}
      {!loading && displayEntries.length > 0 && (
        activeTab === "rejections" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Produced", value: rejSummary.produced.toLocaleString("en-IN") },
              { label: "Total Rejected", value: rejSummary.rejections.toLocaleString("en-IN") },
              { label: "Rejection Rate", value: formatPercent(rejRate) },
              { label: "Cost Loss", value: formatCurrency(rejSummary.cost) },
            ].map((s) => (
              <div key={s.label} className="bg-white border rounded-lg px-4 py-3 text-center">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Produced", value: rewSummary.produced.toLocaleString("en-IN") },
              { label: "Total Rework", value: rewSummary.rework.toLocaleString("en-IN") },
              { label: "Rework Rate", value: formatPercent(rewRate) },
            ].map((s) => (
              <div key={s.label} className="bg-white border rounded-lg px-4 py-3 text-center">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            {activeTab === "rejections" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-muted-foreground">
                    {["Date", "Line", "Part", "Produced", "Rejected", "Rej Rate", "Cost Loss", "Top Defect", ""].map((h) => (
                      <th key={h} className={`px-4 py-3 font-medium whitespace-nowrap ${
                        ["Produced", "Rejected", "Rej Rate", "Cost Loss", ""].includes(h) ? "text-right" : "text-left"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    : rejectionEntries.length === 0
                    ? (
                      <tr>
                        <td colSpan={9} className="text-center py-16 text-muted-foreground">
                          No rejection entries for this period.
                        </td>
                      </tr>
                    )
                    : rejectionEntries.map((entry) => {
                        const { rejQty, cost } = entryTotals(entry.rejections);
                        const rate = entry.producedQty > 0 ? (rejQty / entry.producedQty) * 100 : null;
                        const topDefect = entry.rejections
                          .filter((r) => r.type === "REJECTION")
                          .sort((a, b) => b.qty - a.qty)[0];
                        return (
                          <tr key={entry.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-medium">
                              {format(parseISO(entry.date), "dd MMM yyyy")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="font-normal">{entry.line.name}</Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.part.name}</td>
                            <td className="px-4 py-3 text-right">{entry.producedQty.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-3 text-right font-medium text-red-600">
                              {rejQty > 0 ? rejQty : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {rate !== null ? (
                                <Badge variant={rate > 5 ? "destructive" : "success"} className="font-mono text-xs">
                                  {rate.toFixed(2)}%
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">N/A</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {cost > 0 ? formatCurrency(cost) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[140px]">
                              {topDefect
                                ? <span className="truncate block">{topDefect.defectType.name} <span className="text-gray-400">×{topDefect.qty}</span></span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailEntry(entry)} title="View">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)} title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteEntry(entry.id)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-muted-foreground">
                    {["Date", "Line", "Part", "Produced", "Rework Qty", "Rework Rate", "Top Rework Defect", ""].map((h) => (
                      <th key={h} className={`px-4 py-3 font-medium whitespace-nowrap ${
                        ["Produced", "Rework Qty", "Rework Rate", ""].includes(h) ? "text-right" : "text-left"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    : reworkEntries.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-muted-foreground">
                          No rework entries for this period.
                        </td>
                      </tr>
                    )
                    : reworkEntries.map((entry) => {
                        const { rewQty } = entryTotals(entry.rejections);
                        const rate = entry.producedQty > 0 ? (rewQty / entry.producedQty) * 100 : null;
                        const topRework = entry.rejections
                          .filter((r) => r.type === "REWORK")
                          .sort((a, b) => b.qty - a.qty)[0];
                        return (
                          <tr key={entry.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-medium">
                              {format(parseISO(entry.date), "dd MMM yyyy")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="font-normal">{entry.line.name}</Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.part.name}</td>
                            <td className="px-4 py-3 text-right">{entry.producedQty.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-3 text-right font-medium text-orange-600">
                              {rewQty > 0 ? rewQty : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {rate !== null ? (
                                <Badge variant={rate > 5 ? "destructive" : "warning"} className="font-mono text-xs">
                                  {rate.toFixed(2)}%
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">N/A</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground max-w-[140px]">
                              {topRework
                                ? <span className="truncate block">{topRework.defectType.name} <span className="text-gray-400">×{topRework.qty}</span></span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailEntry(entry)} title="View">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)} title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteEntry(entry.id)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} entries</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DetailDialog
        entry={detailEntry} open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        onEdit={() => { setEditEntry(detailEntry); setDetailEntry(null); }}
      />
      <EditDialog
        entry={editEntry} open={!!editEntry}
        onClose={() => setEditEntry(null)}
        onSaved={fetchEntries}
        defectTypes={defectTypes}
      />
    </div>
  );
}
