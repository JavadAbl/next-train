import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const train = await db.train.findUnique({ where: { id } });
    if (!train) return fail("لوکوموتیو یافت نشد", 404);
    const root = await db.partNode.findFirst({
      where: { trainId: id, parentAreaId: null },
      select: { id: true, name: true, image: true },
    });
    return ok({ train, root });
  } catch (err) {
    return handleError(err);
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  model: z.string().trim().nullable().optional(),
  serialNo: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return fail("داده نامعتبر");

    const train = await db.train.update({ where: { id }, data: parsed.data });
    return ok({ train });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    await db.train.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
