import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail("نام کاربری و رمز عبور الزامی است");

    const user = await db.user.findUnique({ where: { username: parsed.data.username.trim() } });
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return fail("نام کاربری یا رمز عبور نادرست است", 401);
    }
    if (!user.active) return fail("حساب کاربری شما غیرفعال شده است", 403);

    const res = ok({
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
