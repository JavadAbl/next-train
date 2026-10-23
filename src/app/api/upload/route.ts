import { NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";
import { putImage, newImageKey } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // UI advertises 15MB
const MAX_DIM = 2400; // cap oversized diagrams

/** Upload a diagram image — normalized to webp, then stored in Neon Object
 *  Storage (S3-compatible bucket "assets"); when the bucket is unreachable from
 *  this runtime's network the bytes fall back to Postgres (Upload.bytes).
 *  Served through /api/uploads/[id] either way. */
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
      const webp = new Uint8Array(await pipeline.webp({ quality: 82 }).toBuffer());

      const key = newImageKey("webp");
      const storedKey = await putImage(key, webp, "image/webp"); // null → S3 unreachable

      const upload = await db.upload.create({
        data: storedKey
          ? { key: storedKey, mime: "image/webp", size: webp.byteLength }
          : { key: null, mime: "image/webp", bytes: webp, size: webp.byteLength },
      });
      return ok({ url: `/api/uploads/${upload.id}`, storage: storedKey ? "s3" : "db" }, 201);
    } catch (e) {
      console.error("[upload]", e);
      return fail("پردازش تصویر ناموفق بود — فایل تصویری معتبر نیست");
    }
  } catch (err) {
    return handleError(err);
  }
}
