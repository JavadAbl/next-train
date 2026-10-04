"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wrench, Eye, Package, Loader2, ClipboardCheck, History, Info, Hash, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api, TYPE_LABELS, TYPE_BADGES, type RecordRow, type ServiceType, type TreeArea } from "@/lib/client";
import { toISODate, formatJalali, faDigits, faNumber } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import JalaliDateField from "./JalaliDateField";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: TreeArea | null;
  train: { id: string; name: string } | null;
  /** area names from top of hierarchy down to the clicked part (excluding train name) */
  pathNames: string[];
  repairmanName: string;
}

const TYPE_OPTIONS: { value: ServiceType; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "REPAIR", label: "تعمیر", icon: Wrench, hint: "برطرف‌کردن خرابی" },
  { value: "VISIT", label: "بازدید", icon: Eye, hint: "معاینه و پایش وضعیت" },
  { value: "REPLACEMENT", label: "تعویض قطعه", icon: Package, hint: "نصب قطعه نو" },
];

export default function ServiceFormModal({ open, onOpenChange, area, train, pathNames, repairmanName }: Props) {
  const { toast } = useToast();
  const [type, setType] = useState<ServiceType>("REPAIR");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [description, setDescription] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [removedSerial, setRemovedSerial] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<RecordRow[]>([]);

  const loadHistory = useCallback(async () => {
    if (!area) return;
    setBusy(true);
    try {
      const res = await api<{ records: RecordRow[] }>(`/api/records?areaId=${area.id}`);
      setHistory(res.records);
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  }, [area]);

  useEffect(() => {
    if (open) {
      setType("REPAIR");
      setDate(toISODate(new Date()));
      setDescription("");
      setPartNumber("");
      setRemovedSerial("");
      setLaborHours("");
      loadHistory();
    }
  }, [open, loadHistory]);

  // latest record (up to the chosen service date) that registered a serial
  // = what the system expects to be installed at that moment
  const lastSerialRecord = useMemo(
    () => history.find((r) => r.partNumber && r.date.slice(0, 10) <= date) ?? null,
    [history, date]
  );
  const lastSerial = lastSerialRecord?.partNumber ?? null;
  const installedSerial = removedSerial.trim();
  const mismatchActive =
    type === "REPLACEMENT" && !!lastSerial && installedSerial !== "" && installedSerial !== lastSerial;

  const submit = async () => {
    if (!area) return;
    if (description.trim().length < 3) {
      toast({ title: "شرح سرویس الزامی است", description: "حداقل ۳ نویسه توضیح وارد کنید", variant: "destructive" });
      return;
    }
    if (type === "REPLACEMENT" && !partNumber.trim()) {
      toast({ title: "شماره سریال قطعه جدید الزامی است", description: "برای ثبت تعویض قطعه، سریال قطعه نو را وارد کنید", variant: "destructive" });
      return;
    }
    const hours = laborHours.trim() === "" ? null : Number(laborHours);
    if (hours !== null && (isNaN(hours) || hours < 0)) {
      toast({ title: "ساعت کار نامعتبر است", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/records", {
        method: "POST",
        body: JSON.stringify({
          areaId: area.id,
          type,
          date,
          description: description.trim(),
          partNumber: partNumber.trim() || null,
          removedSerial: type === "REPLACEMENT" ? installedSerial || null : null,
          laborHours: hours,
        }),
      });
      toast({ title: "سرویس ثبت شد", description: `برای «${area.name}» در ${train?.name}` });
      setDescription("");
      setPartNumber("");
      setRemovedSerial("");
      setLaborHours("");
      await loadHistory();
    } catch (e) {
      toast({ title: "ثبت ناموفق", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fullPath = train ? [train.name, ...pathNames].join(" › ") : pathNames.join(" › ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" aria-hidden /> ثبت سرویس قطعه
          </DialogTitle>
          <DialogDescription>اطلاعات سرویس برای قطعه انتخاب‌شده را تکمیل و ذخیره کنید</DialogDescription>
        </DialogHeader>

        {/* context (read-only) */}
        <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground">لوکوموتیو:</span>
            <span className="font-semibold">{train?.name}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground">مسیر قطعه:</span>
            <span className="font-medium text-primary">{fullPath}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground">ثبت‌کننده:</span>
            <span className="font-medium">{repairmanName}</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-1.5">
            <Hash className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">آخرین شماره سریال ثبت‌شده (تا تاریخ سرویس):</span>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="در حال بارگذاری" />
            ) : lastSerial ? (
              <>
                <span dir="ltr" className="font-bold tracking-wide">{lastSerial}</span>
                <span className="text-xs text-muted-foreground">({formatJalali(lastSerialRecord!.date)})</span>
              </>
            ) : (
              <span className="text-muted-foreground">هنوز سریالی ثبت نشده است</span>
            )}
          </p>
        </div>

        {/* form */}
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>نوع سرویس *</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="نوع سرویس">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={type === opt.value}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "rounded-lg border-2 p-3 flex flex-col items-center gap-1 transition-all text-center",
                    type === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 text-muted-foreground"
                  )}
                >
                  <opt.icon className="size-5" aria-hidden />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[11px] opacity-70">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-date">تاریخ سرویس *</Label>
            <JalaliDateField id="sf-date" value={date} onChange={setDate} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-desc">شرح سرویس *</Label>
            <Textarea
              id="sf-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً تعویض واشر سرسیلندر شماره ۳ و تنظیم فشار گاز..."
            />
          </div>

          {/* serial verification — only for part replacement */}
          {type === "REPLACEMENT" && (
            <div className="rounded-lg border-2 border-dashed border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2.5">
              <p className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" aria-hidden /> تطبیق شماره سریال پیش از تعویض
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sf-installed">شماره سریال قطعه نصب‌شده فعلی</Label>
                  <Input
                    id="sf-installed"
                    dir="ltr"
                    className="text-left"
                    value={removedSerial}
                    onChange={(e) => setRemovedSerial(e.target.value)}
                    placeholder="سریال روی قطعه..."
                  />
                  <p className="text-[11px] text-muted-foreground">سریالی که روی قطعهِ نصب‌شده خوانده‌اید را وارد کنید تا با آخرین سریال ثبت‌شده تطبیق شود</p>
                </div>
                <div className="space-y-2">
                  {!lastSerial ? (
                    <div className="rounded-lg border bg-muted/40 text-muted-foreground p-2.5 text-xs leading-6">
                      برای این قطعه هنوز سریالی در سامانه ثبت نشده است؛ تطبیق انجام نمی‌شود و ثبت سریال قطعه جدید مبنا قرار می‌گیرد.
                    </div>
                  ) : installedSerial === "" ? (
                    <div className="rounded-lg border bg-muted/40 text-muted-foreground p-2.5 text-xs leading-6">
                      سریال قطعه نصب‌شده فعلی را در کادر روبه‌رو وارد کنید تا با «{lastSerial}» تطبیق داده شود.
                    </div>
                  ) : mismatchActive ? (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive p-2.5 text-xs leading-6" role="alert">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden />
                      <p>
                        کد سریال قطعه نصب‌شده «{installedSerial}» با آخرین سریال ثبت‌شده «{lastSerial}» <b>مطابقت ندارد</b>.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-2.5 text-xs" role="status">
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                      <p>کد سریال قطعه نصب‌شده با آخرین سریال ثبت‌شده مطابقت دارد.</p>
                    </div>
                  )}
                </div>
              </div>
              {/* auto-activating mismatch option */}
              <label
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 text-xs leading-6 select-none",
                  mismatchActive
                    ? "border-amber-500 bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200"
                    : "border-border bg-muted/40 text-muted-foreground/70"
                )}
              >
                <input type="checkbox" className="mt-1 accent-amber-600" checked={mismatchActive} readOnly />
                <span>
                  <b>گزینه «عدم انطباق کد سریال»</b>
                  {mismatchActive
                    ? " — فعال شد؛ این مورد هنگام ثبت سرویس در سوابق و گزارش‌ها درج می‌شود."
                    : " — در صورت عدم تطابق کد سریال قطعه نصب‌شده با آخرین سریال ثبت‌شده، به‌صورت خودکار فعال می‌شود."}
                </span>
              </label>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sf-part" className={cn(type === "REPLACEMENT" && "text-primary font-bold")}>
                {type === "REPLACEMENT" ? "شماره سریال قطعه جدید" : "شماره فنی قطعه"} {type === "REPLACEMENT" && "*"}
              </Label>
              <Input
                id="sf-part"
                dir="ltr"
                className={cn("text-left", type === "REPLACEMENT" && "border-primary/60 ring-2 ring-primary/20")}
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="V-4800"
              />
              <p className="text-[11px] text-muted-foreground">
                {type === "REPLACEMENT" ? "شماره سریال قطعه نو که نصب می‌شود (الزامی)" : "شماره فنی قطعه (اختیاری)"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-hours">ساعت کار</Label>
              <div className="relative">
                <Input
                  id="sf-hours"
                  dir="ltr"
                  type="number"
                  min={0}
                  step={0.5}
                  className="text-left pe-12"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="2.5"
                />
                <span className="absolute inset-y-0 start-3 flex items-center text-xs text-muted-foreground pointer-events-none">ساعت</span>
              </div>
              <p className="text-[11px] text-muted-foreground">مدت زمان صرف‌شده برای این سرویس</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>بستن</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
            ذخیره سرویس
          </Button>
        </div>

        {/* part history */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/40">
            <History className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-semibold">سابقه سرویس «{area?.name}»</p>
            <Badge variant="secondary" className="ms-auto">{faNumber(history.length)} سرویس</Badge>
          </div>
          {busy ? (
            <div className="py-6 flex justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">هنوز سرویسی برای این قطعه ثبت نشده است</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y">
              {history.map((r) => (
                <li key={r.id} className="px-3 py-2 flex items-start gap-2 text-sm">
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGES[r.type]}`}>
                    {TYPE_LABELS[r.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatJalali(r.date)} — {r.repairman.fullName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                    {(r.partNumber || r.removedSerial) && (
                      <p className="text-[11px] text-muted-foreground" dir="ltr">
                        {r.removedSerial ? `${r.removedSerial} → ${r.partNumber ?? "?"}` : `Part: ${r.partNumber}`}
                      </p>
                    )}
                  </div>
                  {r.serialMismatch && (
                    <span className="shrink-0 rounded border border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap">
                      عدم انطباق سریال
                    </span>
                  )}
                  {r.laborHours != null && (
                    <Badge variant="outline" className="shrink-0">{faDigits(r.laborHours)} ساعت</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="size-3" aria-hidden />
          پس از ذخیره، سابقه قطعه در همین بخش به‌روز می‌شود و برای همه کاربران قابل مشاهده است.
        </p>
      </DialogContent>
    </Dialog>
  );
}
