"use client";

import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon, Loader2, ChevronLeft, TrainFront, Wrench, MousePointerClick, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, type TrainSummary, type TrainTree, type TreeArea, type SessionUser } from "@/lib/client";
import { faDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import HotspotImage from "./HotspotImage";
import ServiceFormModal from "./ServiceFormModal";

interface Crumb {
  label: string;
  nodeId: string;
}

interface Props {
  initialTrainId: string | null;
  user: SessionUser;
  onExit: () => void;
}

export default function NavigatorView({ initialTrainId, user, onExit }: Props) {
  const { toast } = useToast();
  const [trains, setTrains] = useState<TrainSummary[] | null>(null);
  const [trainId, setTrainId] = useState<string | null>(initialTrainId);
  const [tree, setTree] = useState<TrainTree | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [modalArea, setModalArea] = useState<TreeArea | null>(null);

  // stage 1: load train list when no train is selected
  useEffect(() => {
    if (trainId) return;
    api<{ trains: TrainSummary[] }>("/api/trains")
      .then((res) => setTrains(res.trains))
      .catch((e) => toast({ title: "خطا", description: e instanceof Error ? e.message : "", variant: "destructive" }));
  }, [trainId, toast]);

  // stage 1: load train list when no train is selected
  useEffect(() => {
    if (!trainId) return;
    let alive = true;
    api<TrainTree>(`/api/trains/${trainId}/tree`)
      .then((res) => {
        if (!alive) return;
        setTree(res);
        setCrumbs(res.root ? [{ label: res.train.name, nodeId: res.root.id }] : []);
      })
      .catch((e) => {
        if (!alive) return;
        toast({ title: "خطا", description: e instanceof Error ? e.message : "بارگذاری ساختار ناموفق بود", variant: "destructive" });
        setTrainId(null);
      });
    return () => { alive = false; };
  }, [trainId, toast]);

  // tree is stale while a different train is being fetched (no synchronous reset needed)
  const treeMatches = !!tree && !!trainId && tree.train.id === trainId;

  const nodeById = useMemo(() => {
    const map = new Map<string, TrainTree["root"]>();
    const walk = (n: TrainTree["root"]) => {
      if (!n) return;
      map.set(n.id, n);
      n.areas.forEach((a) => walk(a.childNode));
    };
    walk(treeMatches ? tree!.root : null);
    return map;
  }, [tree, treeMatches]);

  const currentNode = crumbs.length ? nodeById.get(crumbs[crumbs.length - 1].nodeId) ?? null : null;

  const jumpTo = (index: number) => setCrumbs((c) => c.slice(0, index + 1));

  const onAreaClick = (area: TreeArea) => {
    if (area.childNode) {
      setCrumbs((c) => [...c, { label: area.name, nodeId: area.childNode!.id }]);
    } else {
      setModalArea(area);
    }
  };

  const modalPathNames = modalArea
    ? [...crumbs.slice(1).map((c) => c.label), modalArea.name]
    : [];

  // ---------- stage 1: train picker ----------
  if (!trainId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapIcon className="size-6" aria-hidden /> ثبت سرویس
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            لوکوموتیو را انتخاب کنید، سپس با کلیک روی نواحی نقشه به قطعه موردنظر بروید
          </p>
        </div>
        {trains === null ? (
          <div className="flex justify-center py-24"><Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" /></div>
        ) : trains.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <TrainFront className="size-12 mx-auto mb-3 opacity-40" aria-hidden />
              <p className="font-medium">هیچ لوکوموتیوی تعریف نشده است</p>
              <p className="text-sm mt-1">از اپراتور بخواهید لوکوموتیوها و نقشه‌های فنی را ثبت کند</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trains.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrainId(t.id)}
                className="group text-start rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="aspect-video bg-muted/50">
                  {t.rootImage ? (
                    <img src={t.rootImage} alt={t.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><TrainFront className="size-10 opacity-40" aria-hidden /></div>
                  )}
                </div>
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{faDigits(t.leafParts)} قطعه سرویس‌پذیر</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    <MousePointerClick className="size-3" aria-hidden /> شروع
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- stage 2: hierarchy navigation ----------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTrainId(null)} aria-label="تغییر لوکوموتیو">
            <ArrowLeftRight className="size-5" />
          </Button>
          <h1 className="text-xl font-bold">ناوبری سلسله‌مراتبی</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ChevronLeft className="size-4" /> بازگشت به داشبورد
        </Button>
      </div>

      {/* breadcrumb */}
      <nav aria-label="مسیر پیمایش" className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.nodeId} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground" aria-hidden>›</span>}
            <button
              type="button"
              onClick={() => jumpTo(i)}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                i === crumbs.length - 1
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-current={i === crumbs.length - 1 ? "step" : undefined}
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>

      {trainId && !treeMatches ? (
        <div className="flex justify-center py-24"><Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" /></div>
      ) : currentNode ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-lg">{currentNode.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">سطح {faDigits(crumbs.length)}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Wrench className="size-3" aria-hidden />
                  {faDigits(currentNode.areas.filter((a) => !a.childNode).length)} قطعه پایانی
                </Badge>
              </div>
            </div>
            <HotspotImage
              image={currentNode.image}
              alt={`نقشه ${currentNode.name}`}
              areas={currentNode.areas}
              mode="view"
              onAreaClick={onAreaClick}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MousePointerClick className="size-3.5 shrink-0" aria-hidden />
              ناحیه‌های خاکستری به سطح بعدی می‌روند؛ ناحیه‌های نارنجی قطعه پایانی هستند و فرم ثبت سرویس را باز می‌کنند.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ساختاری برای این لوکوموتیو تعریف نشده است
          </CardContent>
        </Card>
      )}

      <ServiceFormModal
        open={!!modalArea}
        onOpenChange={(o) => !o && setModalArea(null)}
        area={modalArea}
        train={tree?.train ?? null}
        pathNames={modalPathNames}
        repairmanName={user.fullName}
      />
    </div>
  );
}
