"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Part } from "@/types";

export default function AdminPartsPage() {
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState({ name: "", netWeight: "", unitCost: "" });
  const [saving, setSaving] = useState(false);

  const fetchParts = async () => {
    const res = await fetch("/api/parts");
    setParts(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchParts(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", netWeight: "", unitCost: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Part) => {
    setEditing(p);
    setForm({ name: p.name, netWeight: p.netWeight?.toString() ?? "", unitCost: p.unitCost.toString() });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/parts/${editing.id}` : "/api/parts";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          netWeight: form.netWeight ? parseFloat(form.netWeight) : null,
          unitCost: form.unitCost ? parseFloat(form.unitCost) : 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editing ? "Part updated" : "Part created" });
      setDialogOpen(false);
      fetchParts();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Part) => {
    await fetch(`/api/parts/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchParts();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Parts / Machine Types</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Part</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : parts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No parts yet.</p>
          ) : (
            <div className="space-y-2">
              {parts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {!p.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-x-3">
                      {p.unitCost > 0 && <span>Unit cost: {formatCurrency(p.unitCost)}</span>}
                      {p.netWeight && <span>Net weight: {p.netWeight} kg</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => toggleActive(p)}
                      className={p.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}
                    >
                      <PowerOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Part" : "Add Part"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Part Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Inlet Nut, Collar 680..." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Cost (₹)</Label>
                <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Net Weight (kg)</Label>
                <Input type="number" min="0" step="0.001" value={form.netWeight} onChange={(e) => setForm((f) => ({ ...f, netWeight: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
