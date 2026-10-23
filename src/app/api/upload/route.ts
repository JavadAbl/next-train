import { NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // UI advertises 15MB
const MAX_DIM = 2400; // cap oversized diagrams, keeps DB rows lean

/** Upload a diagram image — normalized to webp and stored in the DB (Upload model)
 *  so it also works on serverless hosts with read-only filesystems (Vercel). */
export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("فایلی ارسال نشده است");
    if (file.size > MAX_BYTES) return fail("حجم فایل بیش از حد مجاز است (۱۵ مگابایت)");
    if (file.type && !file.type.startsWith("image/")) return fail("فقط فایل تصویری مجاز است");

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < 16) return fail("فایل تصویری نامعتبر است");

    try {
      let pipeline = sharp(buf, { failOn: "none" }).rotate(); // auto-orient via EXIF
      const meta = await pipeline.metadata();
      if ((meta.width ?? 0) > MAX_DIM || (meta.height ?? 0) > MAX_DIM) {
        pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside" });
      }
      const webp = await pipeline.webp({ quality: 82 }).toBuffer();
      const upload = await db.upload.create({
        data: { mime: "image/webp", bytes: new Uint8Array(webp) },
      });
      return ok({ url: `/api/uploads/${upload.id}` }, 201);
    } catch {
      return fail("پردازش تصویر ناموفق بود — فایل تصویری معتبر نیست");
    }
  } catch (err) {
    return handleError(err);
  }
}
