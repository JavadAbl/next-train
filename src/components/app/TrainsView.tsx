"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrainFront, Plus, Loader2, Pencil, Trash2, Workflow, Map, FileText, Layers, Wrench, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api, type TrainSummary, type SessionUser } from "@/lib/client";
import { faNumber } from "@/lib/jalali";
import ImageUpload from "./ImageUpload";

interface Props {
  user: SessionUser;
  onOpenBuilder: (trainId: string) => void;
  onOpenNavigator: (trainId: string) => void;
  onOpenReport: (trainId: string, filters: { from: string; to: string; type: string }) => void;
}

interface FormState {
  name: string;
  model: string;
  serialNo: string;
  description: string;
  rootName: string;
  imageUrl: string;
}

const EMPTY: FormState = { name: "", model: "", serialNo: "", description: "", rootName: "نمای کلی", imageUrl: "" };

export default function TrainsView({ user, onOpenBuilder, onOpenNavigator, onOpenReport }: Props) {
  const { toast } = useToast();
  const [trains, setTrains] = useState<TrainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editTrain, setEditTrain] = useState<TrainSummary | null>(null);
  const [deleteTrain, setDeleteTrain] = useState<TrainSummary | null>(null);
  const canManage = user.role === "ADMIN" || user.role === "OPERATOR";

  const load = useCallback(async () => {
    try {
      const res = await api<{ trains: TrainSummary[] }>("/api/trains");
      setTrains(res.trains);
    } catch (e) {
      toast({ title: "خطا", description: e instanceof Error ? e.message : "بارگذاری لوکوموتیوها ناموفق بود", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim() || !form.rootName.trim() || !form.imageUrl) {
      toast({ title: "تکمیل موارد الزامی", description: "نام لوکوموتیو، نام سطح اول و تصویر الزامی است", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/trains", {
        method: "POST",
        body: JSON.stringify({
          name: form.name, model: form.model || null, serialNo: form.serialNo || null,
          description: form.description || null, rootName: form.rootName, imageUrl: form.imageUrl,
        }),
      });
      toast({ title: "لوکوموتیو ثبت شد", description: "اکنون ساختار قطعات را ویرایش کنید" });
      setCreateOpen(false);
      setForm(EMPTY);
      await load();
    } catch (e) {
      toast({ title: "ثبت ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editTrain || !form.name.trim()) return;
    setSaving(true);
    try {
      await api(`/api/trains/${editTrain.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: form.name, model: form.model || null, serialNo: form.serialNo || null, description: form.description || null }),
      });
      toast({ title: "اطلاعات به‌روزرسانی شد" });
      setEditTrain(null);
      await load();
    } catch (e) {
      toast({ title: "به‌روزرسانی ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTrain) return;
    try {
      await api(`/api/trains/${deleteTrain.id}`, { method: "DELETE" });
      toast({ title: "لوکوموتیو حذف شد", description: `${deleteTrain.name} به همراه تمام ساختار و سوابق آن حذف شد` });
      setDeleteTrain(null);
      await load();
    } catch (e) {
      toast({ title: "حذف ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrainFront className="size-6" aria-hidden /> لوکوموتیوها
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تعریف لوکوموتیوها و ویرایش ساختار سلسله‌مراتبی قطعات</p>
        </div>
        {canManage && (
          <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
            <Plus className="size-4" /> افزودن لوکوموتیو
          </Button>
        )}
      </div>

      {trains.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <TrainFront className="size-12 mx-auto mb-3 opacity-40" aria-hidden />
            <p className="font-medium">هنوز لوکوموتیوی ثبت نشده است</p>
            {canManage && <p className="text-sm mt-1">با «افزودن لوکوموتیو»، اولین نقشه فنی را بارگذاری کنید</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {trains.map((t) => (
            <Card key={t.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted/50 relative">
                {t.rootImage ? (
                  <img src={t.rootImage} alt={`نقشه ${t.name}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <TrainFront className="size-10 opacity-40" aria-hidden />
                  </div>
                )}
              </div>
              <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <div>
                  <h2 className="font-bold text-lg">{t.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {t.model && <Badge variant="secondary">{t.model}</Badge>}
                    {t.serialNo && <Badge variant="outline">{t.serialNo}</Badge>}
                  </div>
                </div>
                {t.description && <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-auto">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="flex items-center justify-center gap-1 font-semibold"><Layers className="size-3.5" aria-hidden /> {faNumber(t.nodeCount)}</p>
                    <p className="text-muted-foreground">سطح</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="flex items-center justify-center gap-1 font-semibold"><Wrench className="size-3.5" aria-hidden /> {faNumber(t.leafParts)}</p>
                    <p className="text-muted-foreground">قطعه سرویس</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="flex items-center justify-center gap-1 font-semibold"><ClipboardList className="size-3.5" aria-hidden /> {faNumber(t.recordCount)}</p>
                    <p className="text-muted-foreground">سرویس</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="flex-1" onClick={() => onOpenNavigator(t.id)}>
                    <Map className="size-4" /> ثبت سرویس
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => onOpenBuilder(t.id)}>
                      <Workflow className="size-4" /> ویرایش ساختار
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onOpenReport(t.id, { from: "", to: "", type: "" })}>
                    <FileText className="size-4" /> گزارش
                  </Button>
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" aria-label="ویرایش اطلاعات" onClick={() => {
                        setEditTrain(t);
                        setForm({ name: t.name, model: t.model || "", serialNo: t.serialNo || "", description: t.description || "", rootName: "", imageUrl: "" });
                      }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" aria-label="حذف" onClick={() => setDeleteTrain(t)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---- create dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن لوکوموتیو</DialogTitle>
            <DialogDescription>اطلاعات کلی را وارد و نقشه فنی سطح اول را بارگذاری کنید</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="t-name">نام لوکوموتیو *</Label>
                <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً دیزل ۵۰۰" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-model">مدل</Label>
                <Input id="t-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="DL-500" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-serial">شماره سریال</Label>
              <Input id="t-serial" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} placeholder="IR-76-0500" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">توضیحات</Label>
              <Textarea id="t-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-root">نام سطح اول (عنوان نقشه اصلی) *</Label>
              <Input id="t-root" value={form.rootName} onChange={(e) => setForm({ ...form, rootName: e.target.value })} placeholder="نمای کلی" />
            </div>
            <div className="space-y-2">
              <Label>تصویر نقشه فنی سطح اول *</Label>
              <ImageUpload value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>انصراف</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} ثبت لوکوموتیو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- edit dialog ---- */}
      <Dialog open={!!editTrain} onOpenChange={(o) => !o && setEditTrain(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش اطلاعات لوکوموتیو</DialogTitle>
            <DialogDescription>تغییر نام، مدل و توضیحات</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-name">نام لوکوموتیو *</Label>
              <Input id="e-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="e-model">مدل</Label>
                <Input id="e-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-serial">شماره سریال</Label>
                <Input id="e-serial" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-desc">توضیحات</Label>
              <Textarea id="e-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTrain(null)}>انصراف</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- delete confirm ---- */}
      <AlertDialog open={!!deleteTrain} onOpenChange={(o) => !o && setDeleteTrain(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف لوکوموتیو «{deleteTrain?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              تمام سطوح، نواحی و سوابق سرویس این لوکوموتیو به‌طور دائمی حذف می‌شوند. این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">حذف دائمی</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
