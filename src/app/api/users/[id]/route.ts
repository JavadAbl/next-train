import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "REPAIRMAN"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const me = await requireUser("ADMIN");
    const { id } = await params;
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return fail("کاربر یافت نشد", 404);
    if (id === me.id && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "ADMIN"))) {
      return fail("نمی‌توانید نقش یا وضعیت حساب خودتان را تنزل دهید", 400);
    }

    const { password, ...rest } = parsed.data;
    const data = { ...rest, ...(password ? { passwordHash: hashPassword(password) } : {}) };
    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, fullName: true, role: true, active: true },
    });
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const me = await requireUser("ADMIN");
    const { id } = await params;
    if (id === me.id) return fail("حساب خودتان را نمی‌توانید حذف کنید", 400);

    const records = await db.serviceRecord.count({ where: { repairmanId: id } });
    if (records > 0) {
      return fail("این کاربر سابقه ثبت سرویس دارد؛ به‌جای حذف، حساب را غیرفعال کنید", 409);
    }
    await db.user.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
