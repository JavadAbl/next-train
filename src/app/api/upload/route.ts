import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"];

export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN", "OPERATOR");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("فایلی ارسال نشده است");
    if (file.size > MAX_BYTES) return fail("حجم فایل نباید بیشتر از ۱۵ مگابایت باشد");
    if (file.type && !ALLOWED.includes(file.type)) {
      return fail("فقط فایل‌های تصویری (JPG، PNG، WebP) پذیرفته می‌شوند");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    try {
      output = await sharp(buf)
        .rotate() // respect EXIF orientation
        .resize({ width: 1800, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();
    } catch {
      return fail("فایل تصویری معتبر نیست");
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${randomUUID()}.webp`;
    await writeFile(path.join(UPLOAD_DIR, name), output);

    return ok({ url: `/uploads/${name}`, width: 1800 });
  } catch (err) {
    return handleError(err);
  }
}
