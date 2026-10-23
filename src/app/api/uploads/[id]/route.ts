import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getImage } from "@/lib/storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Serve an uploaded diagram image — from Neon Object Storage when the row has
 *  an S3 key, otherwise from the Postgres bytes fallback. Content is immutable
 *  (uuid-keyed) so it can be cached aggressively by the browser/CDN. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]{16,40}$/.test(id)) {
    return new Response("not found", { status: 404 });
  }
  const row = await db.upload.findUnique({ where: { id } });
  if (!row) return new Response("not found", { status: 404 });

  const body = row.key ? await getImage(row.key) : (row.bytes ? new Uint8Array(row.bytes) : null);
  if (!body) return new Response("not found", { status: 404 });

  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
