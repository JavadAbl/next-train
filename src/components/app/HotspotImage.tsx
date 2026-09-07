"use client";

import React, { useCallback, useRef, useState } from "react";
import { Wrench, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeArea } from "@/lib/client";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HotspotImageProps {
  image: string;
  alt: string;
  areas: TreeArea[];
  /** view: navigation (clickable) · edit: builder (selectable) */
  mode: "view" | "edit";
  drawMode?: boolean;
  selectedAreaId?: string | null;
  onAreaClick?: (area: TreeArea) => void;
  onDraw?: (rect: Rect) => void;
  className?: string;
}

/**
 * Renders a technical diagram with percentage-based rectangular hotspots.
 * In view mode: drill-down areas (neutral) vs serviceable leaf parts (amber + wrench).
 * In edit mode + drawMode: pointer-drag creates a new area rect (percent coords).
 */
export default function HotspotImage({
  image,
  alt,
  areas,
  mode,
  drawMode = false,
  selectedAreaId = null,
  onAreaClick,
  onDraw,
  className,
}: HotspotImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const pct = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    const p = pct(e);
    // pointer capture keeps drag events flowing when the cursor leaves the canvas;
    // it can legitimately fail (e.g. non-active pointer id), so never let it abort the drag
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore — drag still works while the pointer is over the canvas */
    }
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawMode || !draft) return;
    const p = pct(e);
    setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };

  const onPointerUp = () => {
    if (!drawMode || !draft) return;
    const rect: Rect = {
      x: Math.min(draft.x0, draft.x1),
      y: Math.min(draft.y0, draft.y1),
      w: Math.abs(draft.x1 - draft.x0),
      h: Math.abs(draft.y1 - draft.y0),
    };
    setDraft(null);
    if (rect.w >= 1.5 && rect.h >= 1.5 && onDraw) onDraw(rect);
  };

  const draftRect = draft
    ? {
        left: `${Math.min(draft.x0, draft.x1)}%`,
        top: `${Math.min(draft.y0, draft.y1)}%`,
        width: `${Math.abs(draft.x1 - draft.x0)}%`,
        height: `${Math.abs(draft.y1 - draft.y0)}%`,
      }
    : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted/40 select-none touch-none",
        drawMode ? "cursor-crosshair" : "cursor-default",
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDraft(null)}
    >
      
      <img
        src={image}
        alt={alt}
        draggable={false}
        className="block w-full h-auto pointer-events-none"
      />

      {areas.map((area) => {
        const selected = selectedAreaId === area.id;
        const leaf = !area.hasChild;
        return (
          <button
            key={area.id}
            type="button"
            aria-label={area.name}
            onClick={(e) => {
              if (drawMode) return;
              e.stopPropagation();
              onAreaClick?.(area);
            }}
            className={cn(
              "hotspot group absolute z-10 flex items-start justify-start p-0",
              drawMode ? "pointer-events-none" : "pointer-events-auto cursor-pointer",
              leaf
                ? "border-2 border-primary/80 bg-primary/15 hover:bg-primary/40"
                : "border-2 border-zinc-500/70 bg-zinc-500/10 hover:bg-zinc-500/30",
              selected && "ring-4 ring-ring/60 border-primary z-20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            style={{
              left: `${area.x}%`,
              top: `${area.y}%`,
              width: `${area.w}%`,
              height: `${area.h}%`,
            }}
          >
            <span
              className={cn(
                "absolute top-0 start-0 max-w-full truncate text-[11px] leading-5 px-1.5 rounded-b-md shadow-sm flex items-center gap-1",
                leaf ? "bg-primary text-primary-foreground" : "bg-zinc-700 text-zinc-50"
              )}
            >
              {leaf ? (
                <Wrench className="size-3 shrink-0" aria-hidden />
              ) : (
                <Layers className="size-3 shrink-0" aria-hidden />
              )}
              <span className="truncate">{area.name}</span>
            </span>
          </button>
        );
      })}

      {draftRect && (
        <div
          className="absolute z-30 border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
          style={draftRect}
        />
      )}
    </div>
  );
}
