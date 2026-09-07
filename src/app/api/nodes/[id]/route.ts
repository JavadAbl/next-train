import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  image: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return fail("داده نامعتبر");

    const node = await db.partNode.update({ where: { id }, data: parsed.data });
    return ok({ node });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE a node — cascades to its areas and their subtrees. Records keep their path snapshot. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const { id } = await params;
    const node = await db.partNode.findUnique({ where: { id } });
    if (!node) return fail("سطح یافت نشد", 404);
    if (node.parentAreaId === null) {
      return fail("سطح ریشه قابل حذف نیست؛ کل لوکوموتیو را حذف کنید", 400);
    }
    await db.partNode.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
