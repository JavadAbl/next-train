"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toJalali, jalaliToDate, jalaliMonthLength, JALALI_MONTHS, faDigits, toISODate } from "@/lib/jalali";

interface Props {
  /** ISO date string "yyyy-mm-dd", or "" for empty (filters). Parent should pass key={value} when the value can be reset to "". */
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
}

/**
 * Jalali (Solar Hijri) date picker: three selects — روز / ماه / سال.
 * Fully controlled when value is set; local partial state only while empty.
 */
export default function JalaliDateField({ value, onChange, id }: Props) {
  // partial picks while value === "" (filter fields)
  const [partial, setPartial] = useState<{ jy: number | null; jm: number | null; jd: number | null } | null>(null);

  const derived = useMemo(() => (value ? toJalali(new Date(value)) : null), [value]);
  const cur = derived ?? partial ?? { jy: null, jm: null, jd: null };
  const { jy, jm, jd } = cur;

  const thisYear = useMemo(() => toJalali(new Date()).jy, []);
  const years = useMemo(() => Array.from({ length: 21 }, (_, i) => thisYear - 10 + i), [thisYear]);
  const days = useMemo(
    () => (jy && jm ? Array.from({ length: jalaliMonthLength(jy, jm) }, (_, i) => i + 1) : []),
    [jy, jm]
  );

  const set = (y: number | null, m: number | null, d: number | null) => {
    if (y && m && d) {
      const safeD = Math.min(d, jalaliMonthLength(y, m));
      setPartial(null);
      onChange(toISODate(jalaliToDate(y, m, safeD)));
    } else {
      setPartial({ jy: y, jm: m, jd: d });
    }
  };

  return (
    <div id={id} className="grid grid-cols-3 gap-2" dir="rtl">
      <Select value={jd ? String(jd) : ""} onValueChange={(v) => set(jy, jm, Number(v))}>
        <SelectTrigger aria-label="روز">
          <SelectValue placeholder="روز" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {days.map((d) => (
            <SelectItem key={d} value={String(d)}>{faDigits(d)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={jm ? String(jm) : ""} onValueChange={(v) => set(jy, Number(v), jd)}>
        <SelectTrigger aria-label="ماه">
          <SelectValue placeholder="ماه" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {JALALI_MONTHS.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={jy ? String(jy) : ""} onValueChange={(v) => set(Number(v), jm, jd)}>
        <SelectTrigger aria-label="سال">
          <SelectValue placeholder="سال" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{faDigits(y)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
