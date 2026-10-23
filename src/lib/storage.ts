import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Neon Object Storage helper (S3-compatible, path-style, SigV4).
 *
 * Primary store for uploaded diagram images. All network calls are defensive:
 * restricted networks (e.g. some dev sandboxes) may block the bucket endpoint,
 * in which case callers fall back to storing bytes in Postgres (Upload.bytes).
 * AWS-standard env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * AWS_ENDPOINT_URL_S3, AWS_REGION) are injected by `neon env pull` / Vercel.
 */

const BUCKET = "assets";

export function storageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

function client(): S3Client {
  return new S3Client({
    forcePathStyle: true, // required: Neon uses path-style addressing
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/** Upload bytes; returns the object key, or null when storage is unreachable. */
export async function putImage(key: string, buf: Uint8Array, mime: string): Promise<string | null> {
  if (!storageConfigured()) return null;
  try {
    await client().send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: mime }),
    );
    return key;
  } catch (e) {
    console.warn("[storage] S3 unreachable, falling back to DB bytes:", (e as Error)?.name);
    return null;
  }
}

/** Fetch object bytes; null when missing or storage unreachable. */
export async function getImage(key: string): Promise<Uint8Array | null> {
  if (!storageConfigured()) return null;
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body?.transformToByteArray();
    return body ?? null;
  } catch {
    return null;
  }
}

/** New unique, cache-friendly object key for an image. */
export function newImageKey(ext: string): string {
  return `uploads/${new Date().toISOString().slice(0, 7).replace("-", "")}/${crypto.randomUUID()}.${ext}`;
}
