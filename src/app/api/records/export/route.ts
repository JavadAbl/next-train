import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { parseISODate, toJalali, formatJalaliDateTime, faDigits, faNumber } from "@/lib/jalali";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "use client" module — cannot be imported here; duplicated for the sheet
const TYPE_LABELS: Record<string, string> = {
  REPAIR: "تعمیر",
  VISIT: "بازدید",
  REPLACEMENT: "تعویض قطعه",
};

/** "۱۴۰۵/۰۷/۱۲" — compact, lexicographically sortable (fixed width, fa digits keep codepoint order). */
function jalaliShort(d: Date): string {
  const { jy, jm, jd } = toJalali(d);
  return faDigits(`${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
}

const COLS = 11; // A..K
const COL_WIDTHS = [6, 13, 18, 44, 13, 16, 22, 22, 17, 9, 44];
const HEADERS = [
  "ردیف", "تاریخ", "لوکوموتیو", "مسیر قطعه", "نوع سرویس", "تعمیرکار",
  "شماره سریال قطعه جدید", "شماره سریال قطعه قبلی", "تطبیق سریال", "ساعت کار", "شرح سرویس",
];

const thin = { style: "thin" as const, color: { argb: "FFE4E4E7" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const wrap = { horizontal: "right" as const, vertical: "middle" as const, wrapText: true };
const center = { horizontal: "center" as const, vertical: "middle" as const };

/** minimal per-cell style carried by the column tuples below */
interface CellStyleLite {
  alignment?: { horizontal?: "center" | "right"; vertical?: "middle"; wrapText?: boolean };
  font?: { bold?: boolean; color?: { argb: string } };
}

/** GET /api/records/export — same filters as /api/records, responds with an .xlsx file. */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;

    const trainId = sp.get("trainId") || undefined;
    const areaId = sp.get("areaId") || undefined;
    const type = sp.get("type") || undefined;
    const repairmanId = sp.get("repairmanId") || undefined;
    const q = sp.get("q") || undefined;
    const from = sp.get("from") || undefined;
    const to = sp.get("to") || undefined;
    const mismatchOnly = sp.get("mismatch") === "true";
    const matchOnly = sp.get("match") === "true";
    const limit = Math.min(Number(sp.get("limit")) || 5000, 5000);

    const records = await db.serviceRecord.findMany({
      where: {
        ...(trainId ? { trainId } : {}),
        ...(areaId ? { areaId } : {}),
        ...(type && ["REPAIR", "VISIT", "REPLACEMENT"].includes(type) ? { type } : {}),
        ...(repairmanId ? { repairmanId } : {}),
        ...(q ? { OR: [{ path: { contains: q } }, { description: { contains: q } }] } : {}),
        ...(from ? { date: { gte: parseISODate(from) } } : {}),
        ...(to ? { date: { lte: parseISODate(to) } } : {}),
        ...(from && to ? { date: { gte: parseISODate(from), lte: parseISODate(to) } } : {}),
        ...(mismatchOnly ? { serialMismatch: true } : {}),
        ...(matchOnly ? { removedSerial: { not: null }, serialMismatch: false } : {}),
      },
      include: {
        repairman: { select: { id: true, fullName: true } },
        train: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    // ---------- workbook ----------
    const wb = new ExcelJS.Workbook();
    wb.creator = "سامانه سرویس لوکوموتیو";
    const ws = wb.addWorksheet("سوابق سرویس", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }],
    });
    ws.columns = COL_WIDTHS.map((w) => ({ width: w }));

    // row 1 — title (merged)
    ws.mergeCells(1, 1, 1, COLS);
    const r1 = ws.getRow(1);
    const t1 = r1.getCell(1);
    t1.value = "گزارش سوابق سرویس لوکوموتیو";
    t1.font = { bold: true, size: 14 };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    r1.height = 26;

    // row 2 — meta + applied filters (merged)
    const meta: string[] = [
      `تاریخ تهیه: ${formatJalaliDateTime(new Date())}`,
      `تعداد سوابق: ${faNumber(records.length)}`,
      `بازه: ${from ? jalaliShort(parseISODate(from)) : "ابتدا"} تا ${to ? jalaliShort(parseISODate(to)) : "اکنون"}`,
    ];
    if (type && TYPE_LABELS[type]) meta.push(`نوع: ${TYPE_LABELS[type]}`);
    if (mismatchOnly) meta.push("فیلتر: فقط عدم انطباق سریال");
    if (matchOnly) meta.push("فیلتر: فقط موارد مطابق");
    if (q) meta.push(`جستجو: «${q}»`);
    ws.mergeCells(2, 1, 2, COLS);
    const r2 = ws.getRow(2);
    const t2 = r2.getCell(1);
    t2.value = meta.join("  ·  ");
    t2.font = { size: 10, color: { argb: "FF71717A" } };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    r2.height = 18;

    // row 3 — column headers
    const r3 = ws.getRow(3);
    for (let c = 1; c <= COLS; c++) {
      const cell = r3.getCell(c);
      cell.value = HEADERS[c - 1];
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = border;
    }
    r3.height = 22;

    const totalHours = records.reduce((s, r) => s + (r.laborHours || 0), 0);
    const mismatchCount = records.filter((r) => r.serialMismatch).length;

    if (records.length === 0) {
      ws.mergeCells(4, 1, 4, COLS);
      const empty = ws.getRow(4).getCell(1);
      empty.value = "سرویسی با این فیلترها یافت نشد";
      empty.font = { italic: true, color: { argb: "FF71717A" } };
      empty.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      records.forEach((r, i) => {
        const row = ws.getRow(4 + i);
        const values: [number, ExcelJS.CellValue, CellStyleLite][] = [
          [1, i + 1, { alignment: center }],
          [2, jalaliShort(r.date), { alignment: center }],
          [3, r.train.name, {}],
          [4, r.path, { alignment: wrap }],
          [5, TYPE_LABELS[r.type] ?? r.type, { alignment: center }],
          [6, r.repairman.fullName, {}],
          [7, r.partNumber ?? "", { alignment: center }],
          [8, r.removedSerial ?? "", { alignment: center }],
          [
            9,
            r.serialMismatch ? "عدم انطباق سریال" : r.removedSerial ? "مطابق" : "—",
            { font: r.serialMismatch
              ? { bold: true, color: { argb: "FF92400E" } }
              : r.removedSerial ? { color: { argb: "FF15803D" } } : {} },
          ],
          [10, r.laborHours ?? "", { alignment: center }],
          [11, r.description, { alignment: wrap }],
        ];
        values.forEach(([col, value, style]) => {
          const cell = row.getCell(col);
          cell.value = value;
          cell.border = border;
          if (style.alignment) cell.alignment = style.alignment;
          if (style.font) cell.font = style.font;
          if (r.serialMismatch) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
          }
        });
      });

      // totals line under the data
      const tr = ws.getRow(4 + records.length);
      ws.mergeCells(tr.number, 1, tr.number, COLS);
      const tc = tr.getCell(1);
      tc.value = `جمع ساعت کار: ${faDigits(totalHours)} ساعت  ·  موارد عدم انطباق سریال: ${faNumber(mismatchCount)}`;
      tc.font = { bold: true };
      tc.alignment = { horizontal: "center", vertical: "middle" };
      tc.border = { top: { style: "double", color: { argb: "FFA1A1AA" } } };
    }

    // filter dropdowns on the header row (covers the data region)
    if (records.length > 0) {
      ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + records.length, column: COLS } };
    }

    const { jy, jm, jd } = toJalali(new Date());
    const filename = `service-records-${jy}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}.xlsx`;

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as unknown as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
