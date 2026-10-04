"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Loader2, RotateCcw, FileText, Search, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, TYPE_LABELS, TYPE_BADGES, type RecordRow, type SessionUser, type TrainSummary, type UserRow } from "@/lib/client";
import { formatJalali, formatJalaliDateTime, faDigits, faNumber } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import JalaliDateField from "./JalaliDateField";
import ExcelIcon from "./ExcelIcon";
import type { View } from "./Shell";

interface Props {
  user: SessionUser;
  onOpenReport: (trainId: string, filters: ReportFilters) => void;
  onNavigate: (view: View) => void;
}

/** serial-match filter state: all | only-mismatch | only-match */
export type SerialFilter = "all" | "mismatch" | "match";

export interface ReportFilters {
  from: string;
  to: string;
  type: string;
  mismatch: SerialFilter;
}

export default function RecordsView({ user, onOpenReport, onNavigate }: Props) {
  const { toast } = useToast();
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [trains, setTrains] = useState<TrainSummary[]>([]);
  const [repairmen, setRepairmen] = useState<UserRow[]>([]);
  const [trainId, setTrainId] = useState("all");
  const [type, setType] = useState("all");
  const [repairmanId, setRepairmanId] = useState("all");
  const [serial, setSerial] = useState<SerialFilter>("all");
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<RecordRow | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (v: string) => {
    setQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQDebounced(v), 400);
  };

  useEffect(() => {
    api<{ trains: TrainSummary[] }>("/api/trains").then((r) => setTrains(r.trains)).catch(() => {});
    api<{ users: UserRow[] }>("/api/users").then((r) => setRepairmen(r.users)).catch(() => {});
  }, []);

  const queryKey = `${trainId}|${type}|${repairmanId}|${qDebounced}|${from}|${to}|${serial}`;
  const [loadedKey, setLoadedKey] = useState("");

  /** single source of truth for the list query AND the excel export */
  const buildFilterParams = useCallback((): URLSearchParams => {
    const sp = new URLSearchParams();
    if (trainId !== "all") sp.set("trainId", trainId);
    if (type !== "all") sp.set("type", type);
    if (repairmanId !== "all") sp.set("repairmanId", repairmanId);
    if (qDebounced.trim()) sp.set("q", qDebounced.trim());
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (serial === "mismatch") sp.set("mismatch", "true");
    if (serial === "match") sp.set("match", "true");
    return sp;
  }, [trainId, type, repairmanId, qDebounced, from, to, serial]);

  useEffect(() => {
    const sp = buildFilterParams();
    let alive = true;
    api<{ records: RecordRow[] }>(`/api/records?${sp.toString()}`)
      .then((res) => {
        if (!alive) return;
        setRecords(res.records);
        setLoadedKey(queryKey);
      })
      .catch((e) => {
        if (!alive) return;
        toast({ title: "خطا", description: e instanceof Error ? e.message : "", variant: "destructive" });
        setRecords([]);
        setLoadedKey(queryKey);
      });
    return () => { alive = false; };
  }, [buildFilterParams, toast, queryKey]);

  // records are stale (refetching) whenever the query key changed but hasn't finished loading
  const loaded = loadedKey === queryKey && records !== null;

  const resetFilters = () => {
    setTrainId("all"); setType("all"); setRepairmanId("all"); setSerial("all"); setQ(""); setQDebounced(""); setFrom(""); setTo("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
  };

  const downloadExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/records/export?${buildFilterParams().toString()}`);
      if (!res.ok) {
        let msg = "";
        try {
          const j = (await res.json()) as { error?: string };
          msg = j.error || "";
        } catch { /* not json */ }
        throw new Error(msg || "خطا در تولید فایل اکسل");
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = /filename="?([^";]+)"?/i.exec(cd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = m?.[1] || "service-records.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "فایل اکسل دانلود شد", description: "سوابق فیلترشدهٔ فعلی در قالب اکسل ذخیره شد" });
    } catch (e) {
      toast({ title: "خطا در دانلود اکسل", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const counts = useMemo(() => {
    const c = { REPAIR: 0, VISIT: 0, REPLACEMENT: 0, mismatch: 0 };
    (records || []).forEach((r) => {
      c[r.type] += 1;
      if (r.serialMismatch) c.mismatch += 1;
    });
    return c;
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6" aria-hidden /> سوابق سرویس
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loaded ? `${faNumber(records?.length ?? 0)} سرویس ثبت‌شده` : "در حال بارگذاری..."}
            <span className="mx-2">·</span>
            تعمیر {faDigits(counts["REPAIR"])}، بازدید {faDigits(counts["VISIT"])}، تعویض {faDigits(counts["REPLACEMENT"])}
            {counts.mismatch > 0 && (
              <>
                <span className="mx-2">·</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">{faDigits(counts.mismatch)} عدم انطباق سریال</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadExcel}
            disabled={!loaded || (records?.length ?? 0) === 0 || exporting}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
            title="خروجی اکسل از سوابقِ فیلترشدهٔ فعلی"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ExcelIcon className="size-4" aria-hidden />}
            {exporting ? "در حال تولید..." : "دانلود اکسل"}
          </Button>
          <Button
            disabled={trainId === "all" || !loaded || (records?.length ?? 0) === 0}
            onClick={() => trainId !== "all" && onOpenReport(trainId, { from, to, type, mismatch: serial })}
            title={trainId === "all" ? "ابتدا یک لوکوموتیو انتخاب کنید" : undefined}
          >
            <FileText className="size-4" /> گزارش چاپی لوکوموتیو
          </Button>
        </div>
      </div>

      {/* filters — 1 col on mobile, 2 at md, 3 at xl; every cell is wide enough for the 3-select Jalali picker */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">لوکوموتیو</Label>
            <Select value={trainId} onValueChange={setTrainId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {trains.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">نوع سرویس</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="REPAIR">تعمیر</SelectItem>
                <SelectItem value="VISIT">بازدید</SelectItem>
                <SelectItem value="REPLACEMENT">تعویض قطعه</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">تعمیرکار</Label>
            <Select value={repairmanId} onValueChange={setRepairmanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {repairmen.filter((u) => u.role === "REPAIRMAN").map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">تطبیق سریال</Label>
            <Select value={serial} onValueChange={(v) => setSerial(v as SerialFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="mismatch">فقط عدم انطباق سریال</SelectItem>
                <SelectItem value="match">فقط مطابق</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">از تاریخ</Label>
            <JalaliDateField key={`from-${from}`} value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">تا تاریخ</Label>
            <JalaliDateField key={`to-${to}`} value={to} onChange={setTo} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs" htmlFor="rec-q">جستجو</Label>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute inset-y-0 end-2.5 size-4 text-muted-foreground self-center" aria-hidden />
                <Input id="rec-q" value={q} onChange={(e) => onSearchChange(e.target.value)} placeholder="مسیر یا شرح..." className="pe-8" />
              </div>
              <Button variant="ghost" size="icon" onClick={resetFilters} aria-label="پاک‌کردن فیلترها" title="پاک‌کردن فیلترها">
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* table */}
      {records === null ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="size-12 mx-auto mb-3 opacity-40" aria-hidden />
            <p className="font-medium">سرویسی با این فیلترها یافت نشد</p>
            {user.role === "REPAIRMAN" && (
              <Button className="mt-4" variant="secondary" onClick={() => onNavigate("navigator")}>
                ثبت اولین سرویس
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">تاریخ</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">لوکوموتیو</th>
                  <th className="px-3 py-2.5 text-start font-medium">مسیر قطعه</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">نوع</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">تعمیرکار</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">شماره فنی</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">تطبیق سریال</th>
                  <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">ساعت</th>
                  <th className="px-3 py-2.5 text-start font-medium">شرح</th>
                  <th className="w-9" aria-label="جزئیات" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setDetail(r)}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatJalali(r.date)}</td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.train.name}</td>
                    <td className="px-3 py-2.5 max-w-72 truncate" title={r.path}>{r.path}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGES[r.type]}`}>
                        {TYPE_LABELS[r.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.repairman.fullName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" dir="ltr">
                      {r.partNumber || "—"}
                      {r.removedSerial && (
                        <span className="block text-[10px] text-muted-foreground" title="سریال قطعهِ نصب‌شده قبلی">قبلی: {r.removedSerial}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.serialMismatch ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600 px-1.5 py-0.5 text-xs font-semibold">
                          <AlertTriangle className="size-3" aria-hidden /> عدم انطباق
                        </span>
                      ) : r.removedSerial ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400">مطابق</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.laborHours != null ? faDigits(r.laborHours) : "—"}</td>
                    <td className="px-3 py-2.5 max-w-64 truncate text-muted-foreground" title={r.description}>{r.description}</td>
                    <td className="px-2"><ChevronDown className="size-4 text-muted-foreground -rotate-90 rtl:rotate-90" aria-hidden /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className={cn("rounded border px-1.5 py-0.5 text-xs font-medium", detail ? TYPE_BADGES[detail.type] : "")}>
                {detail ? TYPE_LABELS[detail.type] : ""}
              </span>
              جزئیات سرویس
            </DialogTitle>
            <DialogDescription>{detail ? formatJalaliDateTime(detail.createdAt) : ""}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid gap-2 text-sm">
              <p className="flex gap-2"><span className="text-muted-foreground shrink-0">لوکوموتیو:</span><span className="font-medium">{detail.train.name}</span></p>
              <p className="flex gap-2"><span className="text-muted-foreground shrink-0">تاریخ سرویس:</span><span className="font-medium">{formatJalali(detail.date)}</span></p>
              <p className="flex gap-2"><span className="text-muted-foreground shrink-0">مسیر قطعه:</span><span className="font-medium text-primary">{detail.path}</span></p>
              <p className="flex gap-2"><span className="text-muted-foreground shrink-0">تعمیرکار:</span><span className="font-medium">{detail.repairman.fullName}</span></p>
              {detail.partNumber && <p className="flex gap-2"><span className="text-muted-foreground shrink-0">شماره فنی قطعه جدید:</span><span dir="ltr" className="font-medium">{detail.partNumber}</span></p>}
              {detail.removedSerial && <p className="flex gap-2"><span className="text-muted-foreground shrink-0">سریال قطعه نصب‌شده قبلی:</span><span dir="ltr" className="font-medium">{detail.removedSerial}</span></p>}
              <p className="flex gap-2 items-center">
                <span className="text-muted-foreground shrink-0">تطبیق سریال:</span>
                {detail.serialMismatch ? (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600 px-1.5 py-0.5 text-xs font-semibold">
                    <AlertTriangle className="size-3" aria-hidden /> عدم انطباق کد سریال
                  </span>
                ) : detail.removedSerial ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">مطابق</span>
                ) : (
                  <span className="text-xs text-muted-foreground">تطبیق نشده (سریالی وارد نشده است)</span>
                )}
              </p>
              {detail.laborHours != null && <p className="flex gap-2"><span className="text-muted-foreground shrink-0">ساعت کار:</span><span className="font-medium">{faDigits(detail.laborHours)}</span></p>}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs mb-1">شرح سرویس</p>
                <p className="leading-7">{detail.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
