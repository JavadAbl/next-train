"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Loader2, Pencil, Trash2, ImageUp, Layers, Wrench, SquareDashedMousePointer,
  Map, Network, Check, ChevronLeft, FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api, type TrainTree, type TreeNode, type TreeArea, type SessionUser } from "@/lib/client";
import { faDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import HotspotImage, { type Rect } from "./HotspotImage";
import ImageUpload from "./ImageUpload";

interface Props {
  trainId: string;
  user: SessionUser;
  onBack: () => void;
  onOpenNavigator: (trainId: string) => void;
}

function findNode(node: TreeNode | null, id: string): TreeNode | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const a of node.areas) {
    const hit = findNode(a.childNode, id);
    if (hit) return hit;
  }
  return null;
}

function nodePath(node: TreeNode | null, targetId: string, acc: string[] = []): string[] | null {
  if (!node) return null;
  const next = [...acc, node.name];
  if (node.id === targetId) return next;
  for (const a of node.areas) {
    const hit = nodePath(a.childNode, targetId, next);
    if (hit) return hit;
  }
  return null;
}

export default function BuilderView({ trainId, user, onBack, onOpenNavigator }: Props) {
  const { toast } = useToast();
  const [tree, setTree] = useState<TrainTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // dialogs
  const [newAreaRect, setNewAreaRect] = useState<Rect | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [childTarget, setChildTarget] = useState<TreeArea | null>(null);
  const [childName, setChildName] = useState("");
  const [childImage, setChildImage] = useState("");
  const [renameNode, setRenameNode] = useState<TreeNode | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [replaceNode, setReplaceNode] = useState<TreeNode | null>(null);
  const [replaceImage, setReplaceImage] = useState("");
  const [deleteNodeTarget, setDeleteNodeTarget] = useState<TreeNode | null>(null);
  const [deleteAreaTarget, setDeleteAreaTarget] = useState<TreeArea | null>(null);
  const [areaRename, setAreaRename] = useState("");

  // plain function (not useCallback): always sees the current selection state
  const load = async (keepSelection = true) => {
    try {
      const res = await api<TrainTree>(`/api/trains/${trainId}/tree`);
      setTree(res);
      const stillThere = keepSelection && findNode(res.root, selectedNodeId || "");
      if (!stillThere) {
        setSelectedNodeId(res.root?.id ?? null);
        setSelectedAreaId(null);
      } else if (selectedAreaId) {
        const node = findNode(res.root, selectedNodeId || "");
        if (!node?.areas.some((a) => a.id === selectedAreaId)) setSelectedAreaId(null);
      }
    } catch (e) {
      toast({ title: "خطا", description: e instanceof Error ? e.message : "بارگذاری ساختار ناموفق بود", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); }, []);

  const currentNode = useMemo(
    () => findNode(tree?.root ?? null, selectedNodeId || "") ?? tree?.root ?? null,
    [tree, selectedNodeId]
  );
  const selectedArea = useMemo(
    () => currentNode?.areas.find((a) => a.id === selectedAreaId) ?? null,
    [currentNode, selectedAreaId]
  );
  const pathNames = useMemo(
    () => nodePath(tree?.root ?? null, currentNode?.id || "") ?? [],
    [tree, currentNode]
  );
  const isRoot = currentNode?.id === tree?.root?.id;

  useEffect(() => {
    if (selectedArea) setAreaRename(selectedArea.name);
  }, [selectedArea]);

  // ---------- actions ----------
  const createArea = async () => {
    if (!currentNode || !newAreaRect || !newAreaName.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ area: { id: string } }>("/api/areas", {
        method: "POST",
        body: JSON.stringify({ nodeId: currentNode.id, name: newAreaName.trim(), ...newAreaRect }),
      });
      toast({ title: "ناحیه ایجاد شد", description: `«${newAreaName.trim()}» به نقشه اضافه شد` });
      setNewAreaRect(null);
      setNewAreaName("");
      await load();
      setSelectedAreaId(res.area.id);
    } catch (e) {
      toast({ title: "ایجاد ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveAreaRename = async () => {
    if (!selectedArea || !areaRename.trim()) return;
    setBusy(true);
    try {
      await api(`/api/areas/${selectedArea.id}`, { method: "PUT", body: JSON.stringify({ name: areaRename.trim() }) });
      toast({ title: "نام ناحیه به‌روزرسانی شد" });
      await load();
    } catch (e) {
      toast({ title: "به‌روزرسانی ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const createChildNode = async () => {
    if (!childTarget || !childName.trim() || !childImage) {
      toast({ title: "تکمیل موارد الزامی", description: "نام سطح و تصویر الزامی است", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ node: { id: string } }>("/api/nodes", {
        method: "POST",
        body: JSON.stringify({ trainId, name: childName.trim(), image: childImage, parentAreaId: childTarget.id }),
      });
      toast({ title: "زیرنقشه ایجاد شد", description: `سطح «${childName.trim()}» به «${childTarget.name}» متصل شد` });
      const childId = res.node.id;
      setChildTarget(null);
      setChildName("");
      setChildImage("");
      await load();
      setSelectedNodeId(childId);
      setSelectedAreaId(null);
      setDrawMode(false);
    } catch (e) {
      toast({ title: "ایجاد ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveNodeRename = async () => {
    if (!renameNode || !renameValue.trim()) return;
    setBusy(true);
    try {
      await api(`/api/nodes/${renameNode.id}`, { method: "PUT", body: JSON.stringify({ name: renameValue.trim() }) });
      toast({ title: "نام سطح به‌روزرسانی شد" });
      setRenameNode(null);
      await load();
    } catch (e) {
      toast({ title: "به‌روزرسانی ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveNodeImage = async () => {
    if (!replaceNode || !replaceImage) return;
    setBusy(true);
    try {
      await api(`/api/nodes/${replaceNode.id}`, { method: "PUT", body: JSON.stringify({ image: replaceImage }) });
      toast({ title: "تصویر سطح جایگزینی شد" });
      setReplaceNode(null);
      setReplaceImage("");
      await load();
    } catch (e) {
      toast({ title: "جایگزینی ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doDeleteNode = async () => {
    if (!deleteNodeTarget) return;
    setBusy(true);
    try {
      await api(`/api/nodes/${deleteNodeTarget.id}`, { method: "DELETE" });
      toast({ title: "سطح حذف شد", description: `«${deleteNodeTarget.name}» و زیرمجموعه آن حذف شد` });
      setDeleteNodeTarget(null);
      if (selectedNodeId === deleteNodeTarget.id) setSelectedNodeId(tree?.root?.id ?? null);
      await load();
    } catch (e) {
      toast({ title: "حذف ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doDeleteArea = async () => {
    if (!deleteAreaTarget) return;
    setBusy(true);
    try {
      await api(`/api/areas/${deleteAreaTarget.id}`, { method: "DELETE" });
      toast({ title: "ناحیه حذف شد", description: `«${deleteAreaTarget.name}» حذف شد` });
      setDeleteAreaTarget(null);
      setSelectedAreaId(null);
      await load();
    } catch (e) {
      toast({ title: "حذف ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" />
      </div>
    );
  }

  if (!tree?.root) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground space-y-3">
          <p className="font-medium">نقشه اصلی برای این لوکوموتیو یافت نشد</p>
          <Button variant="outline" onClick={onBack}><ArrowRight className="size-4" /> بازگشت</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="بازگشت">
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{tree.train.name} — ویرایش ساختار</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              سطوح: {faDigits(pathNames.length)} از {faDigits(countNodes(tree.root))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenNavigator(trainId)}>
            <Map className="size-4" /> مشاهده از دید تعمیرکار
          </Button>
          <Button
            size="sm"
            variant={drawMode ? "default" : "secondary"}
            onClick={() => { setDrawMode((d) => !d); setSelectedAreaId(null); }}
            aria-pressed={drawMode}
          >
            <SquareDashedMousePointer className="size-4" />
            {drawMode ? "در حال ترسیم (کلیک برای پایان)" : "ترسیم ناحیه"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* tree panel */}
        <Card className="w-full lg:w-80 shrink-0">
          <CardContent className="p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-2 py-1">
              <FolderTree className="size-3.5" aria-hidden /> درخت ساختار
            </p>
            <div className="max-h-[70vh] overflow-y-auto mt-1" dir="rtl">
              <TreeItem
                node={tree.root}
                depth={0}
                selectedNodeId={selectedNodeId}
                selectedAreaId={selectedAreaId}
                onSelectNode={(id) => { setSelectedNodeId(id); setSelectedAreaId(null); setDrawMode(false); }}
                onSelectArea={(nodeId, areaId) => { setSelectedNodeId(nodeId); setSelectedAreaId(areaId); setDrawMode(false); }}
              />
            </div>
          </CardContent>
        </Card>

        {/* canvas */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="shrink-0">سطح {faDigits(pathNames.length)}</Badge>
                  <h2 className="font-bold truncate">{currentNode?.name}</h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="تغییر نام سطح" onClick={() => { setRenameNode(currentNode); setRenameValue(currentNode?.name || ""); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="جایگزینی تصویر" onClick={() => { setReplaceNode(currentNode); setReplaceImage(currentNode?.image || ""); }}>
                    <ImageUp className="size-4" />
                  </Button>
                  {!isRoot && (
                    <Button size="icon" variant="ghost" className="text-destructive" aria-label="حذف سطح" onClick={() => setDeleteNodeTarget(currentNode)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                مسیر: {pathNames.join(" › ")}
              </p>
              {drawMode ? (
                <p className="text-sm rounded-lg bg-primary/10 text-primary px-3 py-2 font-medium">
                  حالت ترسیم فعال است — با کشیدن ماوس روی تصویر، مستطیل ناحیه جدید بسازید
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  برای افزودن ناحیه، دکمه «ترسیم ناحیه» را بزنید؛ با کلیک روی هر ناحیه، جزئیات آن نمایش داده می‌شود
                </p>
              )}
              {currentNode && (
                <HotspotImage
                  image={currentNode.image}
                  alt={`نقشه ${currentNode.name}`}
                  areas={currentNode.areas}
                  mode="edit"
                  drawMode={drawMode}
                  selectedAreaId={selectedAreaId}
                  onAreaClick={(a) => { setSelectedAreaId(a.id); setDrawMode(false); }}
                  onDraw={(rect) => { setNewAreaRect(rect); setNewAreaName(""); }}
                />
              )}
              {currentNode && currentNode.areas.length === 0 && !drawMode && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  هنوز ناحیه‌ای روی این نقشه تعریف نشده است
                </p>
              )}
            </CardContent>
          </Card>

          {/* area detail panel */}
          {selectedArea && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold flex items-center gap-2">
                    {selectedArea.hasChild ? <Layers className="size-4 text-muted-foreground" aria-hidden /> : <Wrench className="size-4 text-primary" aria-hidden />}
                    ناحیه «{selectedArea.name}»
                  </h3>
                  <Badge variant="outline">
                    {selectedArea.hasChild ? "دارای زیرنقشه" : "قطعه سرویس‌پذیر (پایانی)"}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="area-name">نام ناحیه</Label>
                    <div className="flex gap-2">
                      <Input id="area-name" value={areaRename} onChange={(e) => setAreaRename(e.target.value)} />
                      <Button size="icon" variant="secondary" aria-label="ذخیره نام" onClick={saveAreaRename} disabled={busy || areaRename.trim() === selectedArea.name}>
                        <Check className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleteAreaTarget(selectedArea)}
                    disabled={busy}
                  >
                    <Trash2 className="size-4" /> حذف ناحیه
                  </Button>
                </div>

                <Separator />

                {selectedArea.hasChild ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">
                      زیرنقشه متصل: <span className="font-semibold">{selectedArea.childNode?.name}</span>
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => { setSelectedNodeId(selectedArea.childNode!.id); setSelectedAreaId(null); }}>
                      <Network className="size-4" /> ورود به زیرنقشه
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 p-3">
                    <p className="text-sm text-primary font-medium">
                      این ناحیه قطعه پایانی است؛ تعمیرکار با کلیک روی آن فرم سرویس را می‌بیند.
                      برای ادامه سلسله‌مراتب، زیرنقشه اضافه کنید:
                    </p>
                    <Button size="sm" onClick={() => { setChildTarget(selectedArea); setChildName(""); setChildImage(""); }}>
                      <Layers className="size-4" /> افزودن زیرنقمه
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ---- new area dialog ---- */}
      <Dialog open={!!newAreaRect} onOpenChange={(o) => !o && setNewAreaRect(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>ناحیه جدید</DialogTitle>
            <DialogDescription>
              نام قطعه یا بخشی که این مستطیل روی نقشه مشخص می‌کند را وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="na-name">نام ناحیه *</Label>
              <Input
                id="na-name"
                autoFocus
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="مثلاً موتور دیزل"
                onKeyDown={(e) => { if (e.key === "Enter") createArea(); }}
              />
            </div>
            {newAreaRect && (
              <p className="text-xs text-muted-foreground">
                موقعیت: {faDigits(Math.round(newAreaRect.x))}٪، {faDigits(Math.round(newAreaRect.y))}٪ —
                ابعاد: {faDigits(Math.round(newAreaRect.w))}٪ × {faDigits(Math.round(newAreaRect.h))}٪
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAreaRect(null)}>انصراف</Button>
            <Button onClick={createArea} disabled={busy || !newAreaName.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} ایجاد ناحیه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- child node dialog ---- */}
      <Dialog open={!!childTarget} onOpenChange={(o) => !o && setChildTarget(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن زیرنقمه برای «{childTarget?.name}»</DialogTitle>
            <DialogDescription>
              تصویر نقشه فنی سطح بعدی را بارگذاری کنید؛ کلیک روی «{childTarget?.name}» کاربر را به این سطح می‌برد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cn-name">نام سطح بعدی *</Label>
              <Input id="cn-name" value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="مثلاً سیلندرها" />
            </div>
            <div className="space-y-2">
              <Label>تصویر نقشه فنی *</Label>
              <ImageUpload value={childImage} onChange={setChildImage} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChildTarget(null)}>انصراف</Button>
            <Button onClick={createChildNode} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} ایجاد و اتصال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- rename node dialog ---- */}
      <Dialog open={!!renameNode} onOpenChange={(o) => !o && setRenameNode(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تغییر نام سطح</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rn-name">نام جدید</Label>
            <Input id="rn-name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameNode(null)}>انصراف</Button>
            <Button onClick={saveNodeRename} disabled={busy || !renameValue.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- replace node image dialog ---- */}
      <Dialog open={!!replaceNode} onOpenChange={(o) => !o && setReplaceNode(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>جایگزینی تصویر «{replaceNode?.name}»</DialogTitle>
            <DialogDescription>
              مختصات نواحی برحسب درصد ذخیره شده‌اند؛ نواحی روی تصویر جدید هم‌اندازه حفظ می‌شوند
            </DialogDescription>
          </DialogHeader>
          <ImageUpload value={replaceImage} onChange={setReplaceImage} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceNode(null)}>انصراف</Button>
            <Button onClick={saveNodeImage} disabled={busy || !replaceImage}>
              {busy && <Loader2 className="size-4 animate-spin" />} جایگزینی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- delete node confirm ---- */}
      <AlertDialog open={!!deleteNodeTarget} onOpenChange={(o) => !o && setDeleteNodeTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سطح «{deleteNodeTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              تمام نواحی که روی این نقشه تعریف شده‌اند به همراه زیرنقشه‌های آن‌ها حذف می‌شوند. سوابق سرویس ثبت‌شده حفظ می‌شوند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteNode} className="bg-destructive text-white hover:bg-destructive/90">حذف سطح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- delete area confirm ---- */}
      <AlertDialog open={!!deleteAreaTarget} onOpenChange={(o) => !o && setDeleteAreaTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف ناحیه «{deleteAreaTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAreaTarget?.hasChild
                ? "زیرنقمه متصل و تمام ساختار زیرمجموعه آن حذف می‌شود. سوابق سرویس حفظ می‌شوند."
                : "این ناحیه قطعه پایانی است و با حذف آن، ثبت سرویس برای این قطعه ممکن نخواهد بود."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={doDeleteArea} className="bg-destructive text-white hover:bg-destructive/90">حذف ناحیه</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function countNodes(node: TreeNode | null): number {
  if (!node) return 0;
  let n = 1;
  for (const a of node.areas) n += countNodes(a.childNode);
  return n;
}

// ---------- recursive tree sidebar ----------
interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedNodeId: string | null;
  selectedAreaId: string | null;
  onSelectNode: (id: string) => void;
  onSelectArea: (nodeId: string, areaId: string) => void;
}

function TreeItem({ node, depth, selectedNodeId, selectedAreaId, onSelectNode, onSelectArea }: TreeItemProps) {
  const selected = selectedNodeId === node.id;
  return (
    <div style={{ paddingInlineStart: depth * 14 }} className="space-y-0.5">
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        className={cn(
          "w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-start transition-colors",
          selected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
        )}
      >
        <FolderTree className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{node.name}</span>
      </button>
      {node.areas.length > 0 && (
        <div className="border-s border-dashed border-border ms-3 ps-2 py-0.5 space-y-0.5">
          {node.areas.map((area) => (
            <div key={area.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectArea(node.id, area.id)}
                className={cn(
                  "w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-start transition-colors",
                  selectedAreaId === area.id ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {area.hasChild ? <Layers className="size-3 shrink-0" aria-hidden /> : <Wrench className="size-3 shrink-0 text-primary" aria-hidden />}
                <span className="truncate">{area.name}</span>
              </button>
              {area.childNode && (
                <TreeItem
                  node={area.childNode}
                  depth={depth + 1}
                  selectedNodeId={selectedNodeId}
                  selectedAreaId={selectedAreaId}
                  onSelectNode={onSelectNode}
                  onSelectArea={onSelectArea}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
