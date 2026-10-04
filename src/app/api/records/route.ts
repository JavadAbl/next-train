import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";
import { parseISODate } from "@/lib/jalali";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEPARATOR = " › ";

/** Walk area → node → parent area → ... building "موتور دیزل › سیلندرها › پیستون › سوپاپ چپ". */
async function buildPath(areaId: string, trainName: string): Promise<string> {
  const names: string[] = [];
  let areaIdCursor: string | null = areaId;
  let guard = 0;
  while (areaIdCursor && guard++ < 100) {
    const area = await db.area.findUnique({
      where: { id: areaIdCursor },
      select: { name: true, node: { select: { parentAreaId: true } } },
    });
    if (!area) break;
    names.unshift(area.name);
    areaIdCursor = area.node.parentAreaId;
  }
  return [trainName, ...names].join(SEPARATOR);
}

// ---------- GET: filtered record list ----------
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
    const limit = Math.min(Number(sp.get("limit")) || 500, 1000);

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
      },
      include: {
        repairman: { select: { id: true, fullName: true } },
        train: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return ok({ records });
  } catch (err) {
    return handleError(err);
  }
}

// ---------- POST: submit a service record ----------
const createSchema = z.object({
  areaId: z.string().min(1, "قطعه انتخاب نشده است"),
  type: z.enum(["REPAIR", "VISIT", "REPLACEMENT"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "قالب تاریخ نامعتبر است"),
  description: z.string().trim().min(3, "شرح سرویس حداقل ۳ نویسه باشد"),
  partNumber: z.string().trim().optional().nullable(),
  removedSerial: z.string().trim().optional().nullable(),
  laborHours: z.number().min(0).max(1000).optional().nullable(),
});

/**
 * Latest serial recorded for this part by a service on/before the given date —
 * i.e. what the system expects to be physically installed at that moment.
 * Date-relative so backdated records compare against the correct predecessor.
 */
async function lastRecordedSerial(areaId: string, asOf: Date): Promise<string | null> {
  const last = await db.serviceRecord.findFirst({
    where: { areaId, partNumber: { not: null }, date: { lte: asOf } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { partNumber: true },
  });
  return last?.partNumber ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");
    const { areaId, type, date, description, partNumber, removedSerial, laborHours } = parsed.data;

    // serial of the NEW part is mandatory for replacements
    if (type === "REPLACEMENT" && !partNumber) {
      return fail("برای تعویض قطعه، ثبت شماره سریال قطعه جدید الزامی است", 400);
    }

    const area = await db.area.findUnique({
      where: { id: areaId },
      include: {
        node: { select: { trainId: true } },
        childNode: { select: { id: true } },
      },
    });
    if (!area) return fail("قطعه یافت نشد", 404);
    if (area.childNode) return fail("این ناحیه قطعه پایانی نیست و سرویس ثبت نمی‌شود", 400);

    const train = await db.train.findUnique({
      where: { id: area.node.trainId },
      select: { id: true, name: true },
    });
    if (!train) return fail("لوکوموتیو یافت نشد", 404);

    const path = await buildPath(areaId, train.name);

    // server-side serial verification: compare the serial read from the physically
    // installed part with the last serial recorded for this part — never trust the client flag
    const expectedSerial = await lastRecordedSerial(areaId, parseISODate(date));
    const removed = removedSerial || null;
    const serialMismatch = Boolean(removed && expectedSerial && removed !== expectedSerial);

    const record = await db.serviceRecord.create({
      data: {
        trainId: train.id,
        areaId,
        path,
        type,
        date: parseISODate(date),
        description,
        partNumber: partNumber || null,
        removedSerial: removed,
        serialMismatch,
        laborHours: laborHours ?? null,
        repairmanId: user.id,
      },
      include: {
        repairman: { select: { id: true, fullName: true } },
        train: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });

    return ok({ record }, 201);
  } catch (err) {
    return handleError(err);
  }
}
