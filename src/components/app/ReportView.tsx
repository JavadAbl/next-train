"use client";

import { useEffect, useState } from "react";
import { Printer, ChevronLeft, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, TYPE_LABELS, type RecordRow } from "@/lib/client";
import { formatJalali, formatJalaliDateTime, faDigits, faNumber } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { ReportFilters } from "./RecordsView";

interface Props {
  trainId: string;
  filters: ReportFilters;
  onBack: () => void;
}

/** Printable per-train service history — browser print (Ctrl+P / چاپ) saves it as PDF. */
export default function ReportView({ trainId, filters, onBack }: Props) {
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [train, setTrain] = useState<{ name: string; model: string | null; serialNo: string | null } | null>(null);

  useEffect(() => {
    api<{ train: { name: string; model: string | null; serialNo: string | null } }>(`/api/trains/${trainId}`)
      .then((r) => setTrain(r.train))
      .catch(() => {});
    const sp = new URLSearchParams({ trainId });
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.type && filters.type !== "all") sp.set("type", filters.type);
    if (filters.mismatch === "mismatch") sp.set("mismatch", "true");
    if (filters.mismatch === "match") sp.set("match", "true");
    api<{ records: RecordRow[] }>(`/api/records?${sp.toString()}`)
      .then((r) => setRecords(r.records))
      .catch(() => setRecords([]));
  }, [trainId, filters]);

  const counts = { REPAIR: 0, VISIT: 0, REPLACEMENT: 0, mismatch: 0 };
  (records || []).forEach((r) => {
    counts[r.type] += 1;
    if (r.serialMismatch) counts.mismatch += 1;
  });
  const totalHours = (records || []).reduce((s, r) => s + (r.laborHours || 0), 0);
  const rangeText = filters.from || filters.to
    ? `بازه: ${filters.from ? formatJalali(new Date(filters.from)) : "ابتدا"} تا ${filters.to ? formatJalali(new Date(filters.to)) : "اکنون"}`
    : "همه بازه‌های زمانی";
  const typeFilterText = filters.type && filters.type !== "all"
    ? ` — فقط ${TYPE_LABELS[filters.type as keyof typeof TYPE_LABELS]}`
    : "";
  const mismatchFilterText = filters.mismatch === "mismatch"
    ? " — فقط عدم انطباق سریال"
    : filters.mismatch === "match"
      ? " — فقط موارد مطابق"
      : "";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" /> بازگشت به سوابق
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> چاپ / ذخیره PDF
        </Button>
      </div>

      {records === null ? (
        <div className="flex justify-center py-24"><Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" /></div>
      ) : (
        <div className="print-root rounded-xl border bg-white p-6 sm:p-8 text-black" dir="rtl">
          {/* header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-black/70 pb-4">
            <div>
              <h1 className="text-xl font-bold">گزارش سرویس لوکوموتیو</h1>
              <p className="text-sm mt-1 font-semibold">{train?.name}</p>
              <p className="text-xs text-black/70 mt-0.5" dir="ltr">
                {[train?.model, train?.serialNo].filter(Boolean).join(" — ") || "—"}
              </p>
            </div>
            <div className="text-xs text-black/70 text-end space-y-0.5">
              <p className="flex items-center gap-1.5 justify-end"><FileText className="size-3.5" aria-hidden /> سامانه سرویس لوکوموتیو</p>
              <p>تاریخ تهیه: {formatJalaliDateTime(new Date())}</p>
              <p>{faNumber(records.length)} سرویس</p>
            </div>
          </div>

          {/* summary */}
          <div className="grid grid-cols-5 gap-2 py-3 text-center text-xs">
            <div className="border rounded p-2">
              <p className="font-bold text-base">{faNumber(records.length)}</p>
              <p className="text-black/70">کل سرویس‌ها</p>
            </div>
            <div className="border rounded p-2">
              <p className="font-bold text-base">{faNumber(counts.REPAIR)}</p>
              <p className="text-black/70">تعمیر</p>
            </div>
            <div className="border rounded p-2">
              <p className="font-bold text-base">{faNumber(counts.VISIT)}</p>
              <p className="text-black/70">بازدید</p>
            </div>
            <div className="border rounded p-2">
              <p className="font-bold text-base">{faNumber(counts.REPLACEMENT)}</p>
              <p className="text-black/70">تعویض قطعه</p>
            </div>
            <div className={cn("rounded p-2 border", counts.mismatch > 0 ? "border-black border-2 bg-black/10" : "border")}>
              <p className="font-bold text-base">{faNumber(counts.mismatch)}</p>
              <p className="text-black/70 font-semibold">عدم انطباق سریال</p>
            </div>
          </div>
          <p className="text-xs text-black/70 mb-3">
            {rangeText}{typeFilterText}{mismatchFilterText} — جمع ساعت کار: {faDigits(totalHours)} ساعت
          </p>

          {/* table */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-y-2 border-black/60 bg-black/5">
                <th className="border border-black/30 px-1.5 py-1.5 w-8">ردیف</th>
                <th className="border border-black/30 px-1.5 py-1.5">تاریخ</th>
                <th className="border border-black/30 px-1.5 py-1.5">مسیر قطعه</th>
                <th className="border border-black/30 px-1.5 py-1.5">نوع</th>
                <th className="border border-black/30 px-1.5 py-1.5">تعمیرکار</th>
                <th className="border border-black/30 px-1.5 py-1.5">شماره سریال</th>
                <th className="border border-black/30 px-1.5 py-1.5">تطبیق</th>
                <th className="border border-black/30 px-1.5 py-1.5">ساعت</th>
                <th className="border border-black/30 px-1.5 py-1.5">شرح</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-black/30 px-1.5 py-6 text-center text-black/60">
                    سرویسی در این بازه ثبت نشده است
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={r.id} className="break-inside-avoid">
                    <td className="border border-black/30 px-1.5 py-1.5 text-center">{faDigits(i + 1)}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 whitespace-nowrap">{formatJalali(r.date)}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 font-medium">{r.path}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 text-center whitespace-nowrap">{TYPE_LABELS[r.type]}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 whitespace-nowrap">{r.repairman.fullName}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 text-center whitespace-nowrap" dir="ltr">
                      {r.partNumber || "—"}
                      {r.removedSerial && (
                        <span className="block text-[9px] text-black/60">({r.removedSerial})</span>
                      )}
                    </td>
                    <td className={cn("border border-black/30 px-1 py-1.5 text-center text-[10px] whitespace-nowrap", r.serialMismatch && "font-bold bg-black/10")}>
                      {r.serialMismatch ? "عدم انطباق" : r.removedSerial ? "مطابق" : "—"}
                    </td>
                    <td className="border border-black/30 px-1.5 py-1.5 text-center">{r.laborHours != null ? faDigits(r.laborHours) : "—"}</td>
                    <td className="border border-black/30 px-1.5 py-1.5 leading-5">{r.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {counts.mismatch > 0 && (
            <div className="mt-3 border-2 border-black rounded p-2 text-[11px] leading-6">
              <p className="font-bold">هشدار: {faNumber(counts.mismatch)} مورد عدم انطباق کد سریال</p>
              <p className="text-black/70">
                در سرویس‌های تعویض قطعه ثبت‌شده در این گزارش، شماره سریال قطعه نصب‌شده با آخرین سریال ثبت‌شده سامانه مطابقت نداشته است؛
                موارد مربوط در ستون «تطبیق» مشخص شده‌اند و نیازمند پیگیری هستند.
              </p>
            </div>
          )}

          <p className="text-[10px] text-black/60 mt-4 text-center">
            این گزارش به‌صورت خودکار از سامانه سرویس لوکوموتیو تهیه شده است.
          </p>
        </div>
      )}
    </div>
  );
}
