import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  w: z.number().min(0.5).max(100).optional(),
  h: z.number().min(0.5).max(100).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return fail("داده نامعتبر");

    const area = await db.area.update({ where: { id }, data: parsed.data });
    return ok({ area });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE an area — cascades to the attached child node subtree. Records keep their path snapshot. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    await db.area.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
