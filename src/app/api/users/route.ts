import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "OPERATOR", "REPAIRMAN"] as const;

export async function GET() {
  try {
    const user = await requireUser();
    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
        _count: { select: { records: true } },
      },
    });
    // non-admins get a minimal projection (used for filter dropdowns)
    if (user.role !== "ADMIN") {
      return ok({ users: users.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role })) });
    }
    return ok({ users });
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "نام کاربری حداقل ۳ نویسه باشد")
    .regex(/^[a-zA-Z0-9_.-]+$/, "نام کاربری فقط شامل حروف لاتین، عدد، نقطه و خط تیره باشد"),
  password: z.string().min(6, "رمز عبور حداقل ۶ نویسه باشد"),
  fullName: z.string().trim().min(2, "نام کامل الزامی است"),
  role: z.enum(ROLES),
});

export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");

    const { username, password, fullName, role } = parsed.data;
    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return fail("این نام کاربری قبلاً ثبت شده است", 409);

    const user = await db.user.create({
      data: { username, passwordHash: hashPassword(password), fullName, role },
    });
    return ok({ user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, active: user.active } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
