"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import type { DefectType } from "@/types";

const CATEGORIES = ["Surface", "Dimensional", "Assembly", "Finishing", "Process", "Material"];

export default function AdminDefectsPage() {
  const { toast } = useToast();
  const [defects, setDefects] = useState<DefectType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editing, setEditing] = useState<DefectType | null>(null);
  const [mergeSource, setMergeSource] = useState<DefectType | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchDefects = async () => {
    const res = await fetch("/api/defect-types");
    setDefects(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchDefects(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (d: DefectType) => {
    setEditing(d);
    setForm({ name: d.name, category: d.category ?? "", description: d.description ?? "" });
    setDialogOpen(true);
  };

  const openMerge = (d: DefectType) => {
    setMergeSource(d);
    setMergeTargetId("");
    setMergeOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/defect-types/${editing.id}` : "/api/defect-types";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category || null,
          description: form.description.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editing ? "Defect type updated" : "Defect type created" });
      setDialogOpen(false);
      fetchDefects();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/defect-types/${mergeSource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeIntoId: mergeTargetId }),
      });
      if (!res.ok) throw new Error("Merge failed");
      toast({ title: "Merged", description: `All "${mergeSource.name}" records moved to the target defect.` });
      setMergeOpen(false);
      fetchDefects();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const grouped = CATEGORIES.reduce<Record<string, DefectType[]>>((acc, cat) => {
    acc[cat] = defects.filter((d) => d.category === cat);
    return acc;
  }, {});
  const uncategorized = defects.filter((d) => !d.category);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Defect Types</CardTitle>
            <CardDescription>Manage and normalize defect type names across all lines</CardDescription>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              {[...CATEGORIES, "Uncategorized"].map((cat) => {
                const items = cat === "Uncategorized" ? uncategorized : grouped[cat] ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
                    <div className="space-y-1">
                      {items.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/30">
                          <div>
                            <span className="font-medium text-sm">{d.name}</span>
                            {d.description && <span className="text-xs text-muted-foreground ml-2">— {d.description}</span>}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="Edit" className="h-7 w-7">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openMerge(d)} title="Merge into another defect" className="h-7 w-7">
                              <GitMerge className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Defect Type" : "Add Defect Type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Dent, Thread No-Go..." autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Defect Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Move all rejection records from <strong>"{mergeSource?.name}"</strong> into another defect type, then deactivate this one.
            </p>
            <div className="space-y-2">
              <Label>Merge into</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger><SelectValue placeholder="Select target defect..." /></SelectTrigger>
                <SelectContent>
                  {defects.filter((d) => d.id !== mergeSource?.id).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={runMerge} disabled={!mergeTargetId || saving}>
              {saving ? "Merging..." : "Merge & Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
