"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Props {
  /** current image url ("" = none yet) */
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}

/** Upload a diagram image (jpg/png/webp) — normalized server-side to webp. */
export default function ImageUpload({ value, onChange, label = "تصویر نقشه فنی", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative rounded-lg border overflow-hidden bg-muted/40">
          
          <img src={value} alt={label} className="block w-full max-h-44 object-contain" />
          <div className="absolute top-2 end-2 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-8"
              aria-label="حذف تصویر"
              onClick={() => onChange("")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          {busy ? <Loader2 className="size-8 animate-spin" /> : <ImagePlus className="size-8" />}
          <span className="text-sm font-medium">{busy ? "در حال بارگذاری..." : label}</span>
          <span className="text-xs">JPG، PNG یا WebP — حداکثر ۱۵ مگابایت</span>
        </button>
      )}
      {value && (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          تغییر تصویر
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
