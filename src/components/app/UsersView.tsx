"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Loader2, Pencil, Trash2, KeyRound, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api, ROLE_LABELS, ROLE_BADGES, type UserRow, type Role } from "@/lib/client";
import { formatJalali, faDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";

interface FormState {
  fullName: string;
  username: string;
  password: string;
  role: Role;
}

const EMPTY: FormState = { fullName: "", username: "", password: "", role: "REPAIRMAN" };

export default function UsersView() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: UserRow[] }>("/api/users");
      setUsers(res.users);
    } catch (e) {
      toast({ title: "خطا", description: e instanceof Error ? e.message : "", variant: "destructive" });
      setUsers([]);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "کاربر ایجاد شد", description: `${form.fullName} (${ROLE_LABELS[form.role]})` });
      setCreateOpen(false);
      setForm(EMPTY);
      await load();
    } catch (e) {
      toast({ title: "ایجاد ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        fullName: editForm.fullName,
        role: editForm.role,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();
      await api(`/api/users/${editUser.id}`, { method: "PUT", body: JSON.stringify(body) });
      toast({ title: "اطلاعات کاربر به‌روزرسانی شد" });
      setEditUser(null);
      await load();
    } catch (e) {
      toast({ title: "به‌روزرسانی ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      await api(`/api/users/${u.id}`, { method: "PUT", body: JSON.stringify({ active: !u.active }) });
      toast({ title: u.active ? "کاربر غیرفعال شد" : "کاربر فعال شد", description: u.fullName });
      await load();
    } catch (e) {
      toast({ title: "عملیات ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!deleteUser) return;
    try {
      await api(`/api/users/${deleteUser.id}`, { method: "DELETE" });
      toast({ title: "کاربر حذف شد", description: deleteUser.fullName });
      setDeleteUser(null);
      await load();
    } catch (e) {
      toast({ title: "حذف ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (users === null) {
    return (
      <div className="flex justify-center py-24"><Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" /></div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6" aria-hidden /> مدیریت کاربران
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {faDigits(users.length)} کاربر — مدیران دسترسی کامل، اپراتورها تعریف لوکوموتیو، تعمیرکارها ثبت سرویس
          </p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
          <Plus className="size-4" /> افزودن کاربر
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">نام کامل</th>
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">نام کاربری</th>
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">نقش</th>
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">وضعیت</th>
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">سرویس‌ها</th>
                <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">عضویت</th>
                <th className="px-3 py-2.5 text-start font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">{u.fullName}</td>
                  <td className="px-3 py-2.5" dir="ltr">{u.username}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_BADGES[u.role])}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={u.active ? "default" : "destructive"} className="whitespace-nowrap">
                      {u.active ? "فعال" : "غیرفعال"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u._count ? faDigits(u._count.records) : "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatJalali(u.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" aria-label="ویرایش" onClick={() => {
                        setEditUser(u);
                        setEditForm({ fullName: u.fullName, username: u.username, password: "", role: u.role });
                      }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={u.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        title={u.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? <UserX className="size-4 text-amber-600" /> : <UserCheck className="size-4 text-emerald-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" aria-label="حذف" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن کاربر</DialogTitle>
            <DialogDescription>کاربر جدید با نقش موردنظر ایجاد کنید</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="u-full">نام کامل *</Label>
              <Input id="u-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="مثلاً رضا محمدی" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-username">نام کاربری *</Label>
                <Input id="u-username" dir="ltr" className="text-left" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="reza_m" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-pass">رمز عبور *</Label>
                <Input id="u-pass" dir="ltr" className="text-left" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="حداقل ۶ نویسه" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>نقش *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">مدیر — دسترسی کامل</SelectItem>
                  <SelectItem value="OPERATOR">اپراتور — تعریف لوکوموتیو و ساختار</SelectItem>
                  <SelectItem value="REPAIRMAN">تعمیرکار — ثبت سرویس</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>انصراف</Button>
            <Button onClick={create} disabled={busy || !form.fullName.trim() || !form.username.trim() || form.password.length < 6}>
              {busy && <Loader2 className="size-4 animate-spin" />} ایجاد کاربر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش «{editUser?.fullName}»</DialogTitle>
            <DialogDescription>تغییر نام، نقش و بازنشانی رمز عبور</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="eu-full">نام کامل</Label>
              <Input id="eu-full" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>نقش</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">مدیر</SelectItem>
                  <SelectItem value="OPERATOR">اپراتور</SelectItem>
                  <SelectItem value="REPAIRMAN">تعمیرکار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eu-pass" className="flex items-center gap-1.5">
                <KeyRound className="size-3.5" aria-hidden /> رمز عبور جدید
              </Label>
              <Input id="eu-pass" dir="ltr" className="text-left" type="text" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="خالی = بدون تغییر" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>انصراف</Button>
            <Button onClick={saveEdit} disabled={busy || !editForm.fullName.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف «{deleteUser?.fullName}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser?._count?.records
                ? "این کاربر سابقه ثبت سرویس دارد و قابل حذف نیست؛ می‌توانید حساب را غیرفعال کنید."
                : "این عملیات قابل بازگشت نیست."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className={cn(deleteUser?._count?.records ? "pointer-events-none opacity-50" : "bg-destructive text-white hover:bg-destructive/90")}
            >
              حذف کاربر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
