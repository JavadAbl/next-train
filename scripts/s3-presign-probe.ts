import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  forcePathStyle: true,
  region: process.env.AWS_REGION!,
  endpoint: process.env.AWS_ENDPOINT_URL_S3!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// presign a PUT, then exercise it with plain fetch to surface the real error body
const key = "uploads/presign-probe.txt";
const putUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: "assets", Key: key, ContentType: "text/plain" }), { expiresIn: 600 });
console.log("presigned PUT host:", new URL(putUrl).host);

const res = await fetch(putUrl, { method: "PUT", body: "hello-presigned", headers: { "Content-Type": "text/plain" } });
console.log("PUT status:", res.status);
const body = await res.text();
console.log("PUT body:", body.slice(0, 800));

if (res.ok) {
  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: "assets", Key: key }), { expiresIn: 600 });
  const g = await fetch(getUrl);
  console.log("GET status:", g.status, "body:", (await g.text()).slice(0, 100));
}
