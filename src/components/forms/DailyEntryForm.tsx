"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, ArrowRight, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Line, Part, DefectType } from "@/types";

interface RejectionRow {
  id: string;
  defectTypeId: string;
  qty: string;
  unitCost: string;
}

export function DailyEntryForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [lines, setLines] = useState<Line[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [defectTypes, setDefectTypes] = useState<DefectType[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState("");
  const [lineId, setLineId] = useState("");
  const [partId, setPartId] = useState("");
  const [producedQty, setProducedQty] = useState("");
  const [productNumber, setProductNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RejectionRow[]>([
    { id: crypto.randomUUID(), defectTypeId: "", qty: "", unitCost: "" },
  ]);

  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  useEffect(() => {
    // en-CA locale formats as YYYY-MM-DD using local timezone
    setDate(new Intl.DateTimeFormat("en-CA").format(new Date()));
  }, []);

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

  useEffect(() => {
    if (!date || !lineId || !partId) { setExistingEntryId(null); return; }
    setCheckingDuplicate(true);
    fetch(`/api/entries?from=${date}&to=${date}&lineId=${lineId}`)
      .then((r) => r.json())
      .then((json) => {
        const match = (json.entries ?? []).find(
          (e: { partId: string; id: string }) => e.partId === partId
        );
        setExistingEntryId(match?.id ?? null);
      })
      .finally(() => setCheckingDuplicate(false));
  }, [date, lineId, partId]);

  useEffect(() => {
    if (!partId) return;
    const part = parts.find((p) => p.id === partId);
    if (!part) return;
    setRows((prev) =>
      prev.map((row) => ({ ...row, unitCost: row.unitCost || String(part.unitCost) }))
    );
  }, [partId, parts]);

  const addRow = () =>
    setRows((prev) => [...prev, { id: crypto.randomUUID(), defectTypeId: "", qty: "", unitCost: "" }]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));
  const updateRow = (id: string, field: keyof RejectionRow, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const totalCost = rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitCost) || 0), 0);
  const totalRejected = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const produced = parseFloat(producedQty) || 0;
  const rejectionRate = produced > 0 ? (totalRejected / produced) * 100 : null;

  const categories = [...new Set(defectTypes.map((d) => d.category).filter(Boolean))];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineId || !partId || !date) {
      toast({ title: "Missing fields", description: "Please fill in date, line, and part.", variant: "destructive" });
      return;
    }
    const validRows = rows.filter((r) => r.defectTypeId && r.qty && parseFloat(r.qty) > 0);
    if (validRows.length === 0) {
      toast({ title: "No defects", description: "Add at least one rejection row.", variant: "destructive" });
      return;
    }
    if (produced > 0 && totalRejected > produced) {
      toast({
        title: "Invalid quantity",
        description: `Total rejected (${totalRejected}) cannot exceed produced quantity (${produced}).`,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, lineId, partId,
          producedQty: parseInt(producedQty) || 0,
          productNumber: productNumber.trim() || undefined,
          notes: notes || undefined,
          rejections: validRows.map((r) => ({
            defectTypeId: r.defectTypeId,
            qty: parseInt(r.qty),
            unitCost: parseFloat(r.unitCost) || 0,
            type: "REJECTION",
          })),
        }),
      });
      if (res.status === 409) {
        toast({
          title: "Entry already exists",
          description: "A rejection entry for this date/line/part exists. Use 'Rework Entry' to add rework.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save entry");
      }
      toast({ title: "Rejection entry saved" });
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
        <CardHeader><CardTitle>Rejection Entry Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <Label>Process Type *</Label>
            <Select value={partId} onValueChange={setPartId}>
              <SelectTrigger><SelectValue placeholder="Select process type..." /></SelectTrigger>
              <SelectContent>
                {parts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.unitCost > 0 && <span className="text-muted-foreground ml-1">(₹{p.unitCost})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="productNumber">Product Number</Label>
            <Input id="productNumber" value={productNumber}
              onChange={(e) => setProductNumber(e.target.value)} placeholder="e.g. PN-001, Batch-42" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="produced">Produced Qty</Label>
            <Input id="produced" type="number" min="0" value={producedQty}
              onChange={(e) => setProducedQty(e.target.value)} placeholder="0" />
          </div>
        </CardContent>
      </Card>

      {existingEntryId && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <p className="text-sm font-medium">Rejection entry already exists for this date, line, and part.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline"
              className="border-blue-400 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
              onClick={() => router.push(`/entry/rework?date=${date}&lineId=${lineId}&partId=${partId}`)}>
              <Wrench className="h-3.5 w-3.5 mr-1" /> Rework Entry
            </Button>
            <Button type="button" size="sm" variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 whitespace-nowrap"
              onClick={() => router.push("/entries")}>
              Go to Entries <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rejection Rows</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            <div className="col-span-5">Defect Type</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2">Unit Cost (₹)</div>
            <div className="col-span-2">Total Cost</div>
            <div className="col-span-1" />
          </div>

          {rows.map((row) => {
            const qty = parseFloat(row.qty) || 0;
            const cost = parseFloat(row.unitCost) || 0;
            return (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 sm:col-span-5">
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
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="1" value={row.qty}
                    onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                    placeholder="Qty" className="text-sm" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input type="number" min="0" step="0.01" value={row.unitCost}
                    onChange={(e) => updateRow(row.id, "unitCost", e.target.value)}
                    placeholder="₹" className="text-sm" />
                </div>
                <div className="col-span-3 sm:col-span-2 text-sm font-medium text-center">
                  {qty * cost > 0 ? formatCurrency(qty * cost) : "—"}
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                    className="h-8 w-8 text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Total Cost Loss: </span>
                <span className="font-bold text-red-600">{formatCurrency(totalCost)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Rejection Rate: </span>
                <span className={`font-bold ${rejectionRate !== null && rejectionRate > 5 ? "text-red-600" : "text-green-600"}`}>
                  {rejectionRate !== null ? `${rejectionRate.toFixed(2)}%` : "N/A"}
                </span>
              </div>
              {(producedQty === "0" || producedQty === "") && (
                <Badge variant="warning" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Rate: N/A (Prod = 0)
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={loading || !!existingEntryId}>
                {loading ? "Saving..." : "Save Rejection Entry"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context for this entry..." className="mt-1" />
        </CardContent>
      </Card>
    </form>
  );
}
