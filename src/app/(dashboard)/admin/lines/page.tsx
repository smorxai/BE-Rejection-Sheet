"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import type { Line } from "@/types";

export default function AdminLinesPage() {
  const { toast } = useToast();
  const [clearingData, setClearingData] = useState(false);

  const clearSeedData = async () => {
    if (!confirm("This will delete all sample/seed entries from the database so you can start entering real data. Continue?")) return;
    setClearingData(true);
    try {
      const res = await fetch("/api/admin/clear-seed", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast({ title: `Cleared ${json.deleted} sample entries. Ready for real data!` });
    } catch (err) {
      toast({ title: "Failed to clear data", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setClearingData(false);
    }
  };
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchLines = async () => {
    const res = await fetch("/api/lines");
    setLines(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLines(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (line: Line) => {
    setEditing(line);
    setForm({ name: line.name, description: line.description ?? "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/lines/${editing.id}` : "/api/lines";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editing ? "Line updated" : "Line created" });
      setDialogOpen(false);
      fetchLines();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (line: Line) => {
    await fetch(`/api/lines/${line.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !line.isActive }),
    });
    fetchLines();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Production Lines</CardTitle>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No lines yet. Add your first production line.</p>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{line.name}</span>
                      {!line.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {line.description && <p className="text-sm text-muted-foreground">{line.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(line)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(line)}
                      title={line.isActive ? "Deactivate" : "Activate"}
                      className={line.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-800"}
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
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Line" : "Add Line"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Line Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. TROB Line, CNC Bay 1..." autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700 text-base">Danger Zone</CardTitle>
          <CardDescription>
            Remove all sample/seed entries so you can start entering real production data. This only deletes entries created during initial setup — your lines, parts, and defect types are kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearSeedData}
            disabled={clearingData}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {clearingData ? "Clearing..." : "Clear Sample Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
