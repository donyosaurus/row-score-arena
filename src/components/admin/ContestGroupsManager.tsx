import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical, ChevronUp, ChevronDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ContestGroup {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  contest_count?: number;
}

interface ContestTemplate {
  id: string;
  regatta_name: string;
  contest_group_id: string | null;
  display_order_in_group: number;
  status: string;
}

export const ContestGroupsManager = () => {
  const [groups, setGroups] = useState<ContestGroup[]>([]);
  const [templates, setTemplates] = useState<ContestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ContestGroup | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formVisible, setFormVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [groupsRes, templatesRes] = await Promise.all([
      supabase.from("contest_groups").select("*").order("display_order"),
      supabase.from("contest_templates").select("id, regatta_name, contest_group_id, display_order_in_group, status"),
    ]);

    const groupsData = groupsRes.data || [];
    const templatesData = templatesRes.data || [];

    // Count contests per group
    const enriched = groupsData.map(g => ({
      ...g,
      contest_count: templatesData.filter(t => t.contest_group_id === g.id).length,
    }));

    setGroups(enriched);
    setTemplates(templatesData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setFormName(""); setFormDesc(""); setFormVisible(true);
    setEditGroup(null); setCreateOpen(true);
  };

  const openEdit = (g: ContestGroup) => {
    setFormName(g.name); setFormDesc(g.description || ""); setFormVisible(g.is_visible);
    setEditGroup(g); setCreateOpen(true);
  };

  const saveGroup = async () => {
    if (!formName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editGroup) {
        const { error } = await supabase.from("contest_groups")
          .update({ name: formName.trim(), description: formDesc.trim() || null, is_visible: formVisible, updated_at: new Date().toISOString() })
          .eq("id", editGroup.id);
        if (error) throw error;
        toast.success("Group updated");
      } else {
        const nextOrder = groups.length;
        const { error } = await supabase.from("contest_groups")
          .insert({ name: formName.trim(), description: formDesc.trim() || null, is_visible: formVisible, display_order: nextOrder });
        if (error) throw error;
        toast.success("Group created");
      }
      setCreateOpen(false);
      fetchData();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteGroup = async (g: ContestGroup) => {
    if ((g.contest_count || 0) > 0) {
      toast.error("Remove all contests from this group first");
      return;
    }
    if (!confirm(`Delete group "${g.name}"?`)) return;
    const { error } = await supabase.from("contest_groups").delete().eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Group deleted");
    fetchData();
  };

  const moveGroup = async (index: number, direction: -1 | 1) => {
    const newGroups = [...groups];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= newGroups.length) return;
    [newGroups[index], newGroups[swapIdx]] = [newGroups[swapIdx], newGroups[index]];

    setGroups(newGroups);
    for (let i = 0; i < newGroups.length; i++) {
      await supabase.from("contest_groups").update({ display_order: i }).eq("id", newGroups[i].id);
    }
  };

  const moveContestInGroup = async (templateId: string, groupId: string, direction: -1 | 1) => {
    const groupTemplates = templates
      .filter(t => t.contest_group_id === groupId)
      .sort((a, b) => a.display_order_in_group - b.display_order_in_group);

    const idx = groupTemplates.findIndex(t => t.id === templateId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= groupTemplates.length) return;

    [groupTemplates[idx], groupTemplates[swapIdx]] = [groupTemplates[swapIdx], groupTemplates[idx]];

    for (let i = 0; i < groupTemplates.length; i++) {
      await supabase.from("contest_templates").update({ display_order_in_group: i }).eq("id", groupTemplates[i].id);
    }
    fetchData();
  };

  const assignContestToGroup = async (templateId: string, groupId: string | null) => {
    const { error } = await supabase.from("contest_templates")
      .update({ contest_group_id: groupId, display_order_in_group: 0 })
      .eq("id", templateId);
    if (error) { toast.error(error.message); return; }
    toast.success("Contest reassigned");
    fetchData();
  };

  const ungroupedTemplates = templates.filter(t => !t.contest_group_id);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Contest Groups</CardTitle><CardDescription>Organize contests into sections on the lobby page</CardDescription></div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create Group</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {groups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No groups yet. Create one to organize your contests.</p>}
          {groups.map((g, idx) => (
            <div key={g.id} className="border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{g.name}</span>
                    <Badge variant={g.is_visible ? "default" : "secondary"}>{g.is_visible ? "Visible" : "Hidden"}</Badge>
                    <span className="text-sm text-muted-foreground">{g.contest_count || 0} contest{(g.contest_count || 0) !== 1 ? "s" : ""}</span>
                  </div>
                  {g.description && <p className="text-sm text-muted-foreground mt-0.5">{g.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveGroup(idx, -1)}><ChevronUp className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={idx === groups.length - 1} onClick={() => moveGroup(idx, 1)}><ChevronDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteGroup(g)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Contests in this group */}
              {(() => {
                const groupContests = templates
                  .filter(t => t.contest_group_id === g.id)
                  .sort((a, b) => a.display_order_in_group - b.display_order_in_group);
                if (groupContests.length === 0) return null;
                return (
                  <div className="mt-3 ml-8 space-y-1">
                    {groupContests.map((t, tIdx) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm p-1.5 rounded bg-muted/50">
                        <span className="text-muted-foreground w-5 text-right">{tIdx + 1}.</span>
                        <span className="flex-1 truncate">{t.regatta_name}</span>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={tIdx === 0} onClick={() => moveContestInGroup(t.id, g.id, -1)}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={tIdx === groupContests.length - 1} onClick={() => moveContestInGroup(t.id, g.id, 1)}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ungrouped contests with reassignment */}
      {ungroupedTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ungrouped Contests ({ungroupedTemplates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ungroupedTemplates.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <span className="flex-1 text-sm font-medium truncate">{t.regatta_name}</span>
                <Select onValueChange={(val) => assignContestToGroup(t.id, val === "none" ? null : val)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Move to group..." /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grouped contests reassignment in the contest table */}
      {groups.length > 0 && templates.filter(t => t.contest_group_id).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reassign Grouped Contests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.filter(t => t.contest_group_id).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <span className="flex-1 text-sm font-medium truncate">{t.regatta_name}</span>
                <Select value={t.contest_group_id || "none"} onValueChange={(val) => assignContestToGroup(t.id, val === "none" ? null : val)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ungrouped</SelectItem>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGroup ? "Edit Contest Group" : "Create Contest Group"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="IRA Championship Series" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Top IRA regattas for 2026" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="groupVisible" checked={formVisible} onCheckedChange={(c) => setFormVisible(c === true)} />
              <Label htmlFor="groupVisible" className="cursor-pointer">Visible in lobby</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={saveGroup} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editGroup ? "Save Changes" : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
