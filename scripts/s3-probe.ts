import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  forcePathStyle: true,
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const Key = "uploads/test-probe.txt";
try {
  const p = await s3.send(new PutObjectCommand({ Bucket: "assets", Key, Body: "hello-neon", ContentType: "text/plain" }));
  console.log("put status", p.$metadata.httpStatusCode);
  const r = await s3.send(new GetObjectCommand({ Bucket: "assets", Key }));
  console.log("get:", await r.Body!.transformToString());
} catch (e: any) {
  console.log("ERR name:", e?.name, "| status:", e?.$metadata?.httpStatusCode);
  console.log("ERR msg:", String(e?.message).slice(0, 300));
  console.log("ERR body:", String(e?.$responseBodyText ?? e?.Code ?? "").slice(0, 500));
}
