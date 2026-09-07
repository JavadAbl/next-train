"use client";

import { useEffect, useState } from "react";
import {
  TrainFront, Wrench, ClipboardList, Users, Map, Workflow, Plus,
  Wrench as WrenchIcon, Eye, Package, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, TYPE_LABELS, TYPE_BADGES, ROLE_LABELS, type SessionUser, type RecordRow } from "@/lib/client";
import { formatJalali, faNumber } from "@/lib/jalali";
import type { View } from "./Shell";

interface Stats {
  trains: number;
  leafParts: number;
  users: number;
  records: number;
  monthRecords: number;
  byType: Record<string, number>;
}

interface Props {
  user: SessionUser;
  onNavigate: (view: View) => void;
  onOpenNavigator: () => void;
  onOpenTrains: () => void;
}

export default function DashboardView({ user, onNavigate, onOpenNavigator, onOpenTrains }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecordRow[] | null>(null);

  useEffect(() => {
    api<{ stats: Stats; recent: RecordRow[] }>("/api/stats")
      .then((r) => { setStats(r.stats); setRecent(r.recent); })
      .catch(() => { setStats(null); setRecent([]); });
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "صبح‌بخیر";
    if (h < 17) return "ظهر بخیر";
    if (h < 20) return "عصر بخیر";
    return "شب بخیر";
  };

  const cards = [
    { label: "لوکوموتیوهای فعال", value: stats?.trains, icon: TrainFront, action: onOpenTrains, actionLabel: "مدیریت" },
    { label: "قطعات سرویس‌پذیر", value: stats?.leafParts, icon: Wrench, action: onOpenNavigator, actionLabel: "ثبت سرویس" },
    { label: "سرویس‌های این ماه", value: stats?.monthRecords, icon: ClipboardList, action: () => onNavigate("records"), actionLabel: "سوابق" },
    { label: "کاربران فعال", value: stats?.users, icon: Users, action: () => onNavigate("users"), actionLabel: "کاربران" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}، {user.fullName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            نقش شما: {ROLE_LABELS[user.role]}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onOpenNavigator}><Map className="size-4" /> ثبت سرویس جدید</Button>
          {(user.role === "ADMIN" || user.role === "OPERATOR") && (
            <Button variant="secondary" onClick={onOpenTrains}><Workflow className="size-4" /> ساختار لوکوموتیوها</Button>
          )}
        </div>
      </div>

      {/* stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <c.icon className="size-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                {c.value === undefined && stats === null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-bold tabular-nums">{faNumber(c.value ?? 0)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={c.action}>
                {c.actionLabel === "کاربران" && user.role !== "ADMIN" ? null : c.actionLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* type breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">ترکیب سرویس‌ها</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats === null ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                {(["REPAIR", "VISIT", "REPLACEMENT"] as const).map((t) => {
                  const total = Math.max(stats.records, 1);
                  const val = stats.byType[t] || 0;
                  const pct = Math.round((val / total) * 100);
                  return (
                    <div key={t} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5">
                          {t === "REPAIR" ? <WrenchIcon className="size-3.5" aria-hidden /> : t === "VISIT" ? <Eye className="size-3.5" aria-hidden /> : <Package className="size-3.5" aria-hidden />}
                          {TYPE_LABELS[t]}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{faNumber(val)} ({faNumber(pct)}٪)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">مجموع سوابق ثبت‌شده: {faNumber(stats.records)}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* recent records */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">آخرین سرویس‌های ثبت‌شده</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("records")}>مشاهده همه</Button>
          </CardHeader>
          <CardContent>
            {recent === null ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recent.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <ClipboardList className="size-10 mx-auto mb-2 opacity-40" aria-hidden />
                هنوز سرویسی ثبت نشده است
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={onOpenNavigator}><Plus className="size-4" /> ثبت اولین سرویس</Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y max-h-80 overflow-y-auto -mx-2">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-2 py-2.5 text-sm">
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGES[r.type]}`}>
                      {TYPE_LABELS[r.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.path}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.repairman.fullName} · {r.description}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 whitespace-nowrap">{formatJalali(r.date)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* how-to card for repairmen */}
      {user.role === "REPAIRMAN" && (
        <Card className="bg-muted/40">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start gap-4">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Map className="size-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">راهنمای ثبت سریع سرویس</p>
              <ol className="text-sm text-muted-foreground list-decimal ps-5 space-y-0.5">
                <li>روی «ثبت سرویس جدید» بزنید و لوکوموتیو را انتخاب کنید</li>
                <li>روی نواحی نقشه کلیک کنید تا به قطعه موردنظر برسید (مثلاً موتور › سیلندر › پیستون › سوپاپ چپ)</li>
                <li>روی قطعه پایانی (نارنجی) کلیک کنید، فرم سرویس باز می‌شود</li>
                <li>نوع سرویس، تاریخ و شرح را وارد و ذخیره کنید — سابقه قطعه هم نمایش داده می‌شود</li>
              </ol>
              {stats === null ? <Loader2 className="size-4 animate-spin" /> : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
