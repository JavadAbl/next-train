import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const createSchema = z.object({
  trainId: z.string().min(1),
  name: z.string().trim().min(1, "نام سطح الزامی است"),
  image: z.string().min(1, "تصویر الزامی است"),
  parentAreaId: z.string().min(1, "ناحیه والد الزامی است"),
});

/** POST: create a child node under an area (attach a child diagram). */
export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");

    const { trainId, name, image, parentAreaId } = parsed.data;
    const parentArea = await db.area.findUnique({
      where: { id: parentAreaId },
      include: { childNode: { select: { id: true } }, node: { select: { trainId: true } } },
    });
    if (!parentArea) return fail("ناحیه والد یافت نشد", 404);
    if (parentArea.node.trainId !== trainId) return fail("ناحیه والد به این لوکوموتیو تعلق ندارد");
    if (parentArea.childNode) return fail("این ناحیه قبلاً زیرنقشه دارد", 409);

    const node = await db.partNode.create({ data: { trainId, name, image, parentAreaId } });
    return ok({ node }, 201);
  } catch (err) {
    return handleError(err);
  }
}
