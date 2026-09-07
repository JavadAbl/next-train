import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const createSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().trim().min(1, "نام ناحیه الزامی است"),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0.5).max(100),
  h: z.number().min(0.5).max(100),
});

export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");

    const { nodeId, name, x, y, w, h } = parsed.data;
    const node = await db.partNode.findUnique({ where: { id: nodeId }, select: { id: true } });
    if (!node) return fail("سطح یافت نشد", 404);

    const count = await db.area.count({ where: { nodeId } });
    const area = await db.area.create({
      data: { nodeId, name, x, y, w, h, sortOrder: count },
    });
    return ok({ area }, 201);
  } catch (err) {
    return handleError(err);
  }
}
