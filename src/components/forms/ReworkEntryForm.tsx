"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type { Line, Part, DefectType } from "@/types";

interface ReworkRow {
  id: string;
  defectTypeId: string;
  qty: string;
}

interface LinkedEntry {
  id: string;
  producedQty: number;
  rejections: Array<{ id: string; defectTypeId: string; qty: number; unitCost: number; type: string }>;
}

export function ReworkEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [lines, setLines] = useState<Line[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState("");
  const [lineId, setLineId] = useState(searchParams.get("lineId") ?? "");
  const [partId, setPartId] = useState(searchParams.get("partId") ?? "");
  const [producedQty, setProducedQty] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ReworkRow[]>([
    { id: crypto.randomUUID(), defectTypeId: "", qty: "" },
  ]);

  // Linked rejection entry for this date/line/part (if any)
  const [linkedEntry, setLinkedEntry] = useState<LinkedEntry | null>(null);
  const [checkingLinked, setCheckingLinked] = useState(false);

  useEffect(() => {
    const paramDate = searchParams.get("date");
    if (paramDate) {
      setDate(paramDate);
    } else {
      const t = new Date();
      const yyyy = t.getFullYear();
      const mm = String(t.getMonth() + 1).padStart(2, "0");
      const dd = String(t.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/lines").then((r) => r.json()),
      fetch("/api/parts").then((r) => r.json()),
      fetch("/api/defect-types").then((r) => r.json()),
    ]).then(([l, p, d]) => {
      setLines(l);
      setParts(p);
      setDefectTypes(d);
    });
  }, []);

  // Find linked rejection entry whenever date/line/part change
  useEffect(() => {
    if (!date || !lineId || !partId) { setLinkedEntry(null); return; }
    setCheckingLinked(true);
    fetch(`/api/entries?from=${date}&to=${date}&lineId=${lineId}`)
      .then((r) => r.json())
      .then(async (json) => {
        const match = (json.entries ?? []).find(
          (e: { partId: string; id: string }) => e.partId === partId
        );
        if (match) {
          const detail = await fetch(`/api/entries/${match.id}`).then((r) => r.json());
          setLinkedEntry(detail);
          setProducedQty(String(detail.producedQty));
        } else {
          setLinkedEntry(null);
          setProducedQty("");
        }
      })
      .finally(() => setCheckingLinked(false));
  }, [date, lineId, partId]);

  const addRow = () => setRows((prev) => [...prev, { id: crypto.randomUUID(), defectTypeId: "", qty: "" }]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id: string, field: keyof ReworkRow, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const totalRework = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const produced = parseFloat(producedQty) || 0;
  const reworkRate = produced > 0 ? (totalRework / produced) * 100 : null;

  const categories = [...new Set(defectTypes.map((d) => d.category).filter(Boolean))];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId || !partId || !date) {
      toast({ title: "Missing fields", description: "Please fill in date, line, and part.", variant: "destructive" });
      return;
    }
    const validRows = rows.filter((r) => r.defectTypeId && r.qty && parseFloat(r.qty) > 0);
    if (validRows.length === 0) {
      toast({ title: "No rework rows", description: "Add at least one rework row.", variant: "destructive" });
      return;
    }
    if (produced > 0 && totalRework > produced) {
      toast({
        title: "Rework exceeds produced",
        description: `Total rework (${totalRework}) cannot exceed produced quantity (${produced}).`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (linkedEntry) {
        // PATCH: merge existing rows + new rework rows
        const mergedRejections = [
          ...linkedEntry.rejections.map((r) => ({
            id: r.id,
            defectTypeId: r.defectTypeId,
            qty: r.qty,
            unitCost: r.unitCost,
            type: r.type as "REJECTION" | "REWORK",
          })),
          ...validRows.map((r) => ({
            defectTypeId: r.defectTypeId,
            qty: parseInt(r.qty),
            unitCost: 0,
            type: "REWORK" as const,
          })),
        ];
        const res = await fetch(`/api/entries/${linkedEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejections: mergedRejections }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to save"); }
      } else {
        // POST: new entry with rework-only rows
        const res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, lineId, partId,
            producedQty: parseInt(producedQty) || 0,
            notes: notes || undefined,
            rejections: validRows.map((r) => ({
              defectTypeId: r.defectTypeId,
              qty: parseInt(r.qty),
              unitCost: 0,
              type: "REWORK",
            })),
          }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to save"); }
      }

      toast({ title: "Rework entry saved" });
      router.push("/entries");
      router.refresh();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Rework Entry Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" type="date" value={date} max={date || undefined}
              onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Production Line *</Label>
            <Select value={lineId} onValueChange={setLineId}>
              <SelectTrigger><SelectValue placeholder="Select line..." /></SelectTrigger>
              <SelectContent>
                {lines.filter((l) => l.isActive).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Part / Machine *</Label>
            <Select value={partId} onValueChange={setPartId}>
              <SelectTrigger><SelectValue placeholder="Select part..." /></SelectTrigger>
              <SelectContent>
                {parts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="produced">Produced Qty {linkedEntry && <span className="text-xs text-muted-foreground">(from rejection entry)</span>}</Label>
            <Input id="produced" type="number" min="0" value={producedQty}
              onChange={(e) => setProducedQty(e.target.value)}
              placeholder="0"
              readOnly={!!linkedEntry}
              className={linkedEntry ? "bg-gray-50 text-muted-foreground" : ""}
            />
          </div>
        </CardContent>
      </Card>

      {/* Link status */}
      {date && lineId && partId && !checkingLinked && (
        linkedEntry ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
            <Info className="h-4 w-4 text-green-500 flex-shrink-0" />
            Linked to existing rejection entry — rework will be added alongside rejection data.
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            No rejection entry found for this date/line/part — a new rework-only entry will be created.
          </div>
        )
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rework Rows</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-8">Defect Type</div>
            <div className="col-span-3">Rework Qty</div>
            <div className="col-span-1" />
          </div>

          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 sm:col-span-8">
                <Select value={row.defectTypeId} onValueChange={(v) => updateRow(row.id, "defectTypeId", v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select defect..." /></SelectTrigger>
                  <SelectContent>
                    {categories.length > 0
                      ? categories.map((cat) => (
                          <div key={cat}>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{cat}</div>
                            {defectTypes.filter((d) => d.category === cat && d.isActive).map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </div>
                        ))
                      : defectTypes.filter((d) => d.isActive).map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-11 sm:col-span-3">
                <Input type="number" min="1" value={row.qty}
                  onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                  placeholder="Qty" className="text-sm" />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon"
                  onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                  className="h-8 w-8 text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Total Rework Qty: </span>
                <span className="font-bold text-orange-600">{totalRework}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Rework Rate: </span>
                <span className={`font-bold ${reworkRate !== null && reworkRate > 5 ? "text-red-600" : "text-orange-600"}`}>
                  {reworkRate !== null ? `${reworkRate.toFixed(2)}%` : "N/A"}
                </span>
              </div>
              {totalRework > produced && produced > 0 && (
                <span className="text-sm text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Exceeds produced qty
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Rework Entry"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context for this rework entry..." className="mt-1" />
        </CardContent>
      </Card>
    </form>
  );
}
