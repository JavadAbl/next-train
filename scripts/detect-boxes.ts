import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const DEMO_DIR = path.join(process.cwd(), "assets", "demo");
const OUT = path.join(DEMO_DIR, "boxes.json");

const TARGETS: Record<string, string[]> = {
  locomotive: ["engine compartment in the long hood", "driver cab", "bogie wheelset area with brakes"],
  engine: ["cylinder bank", "turbocharger", "oil pump"],
  cylinders: ["pistons below the cylinder heads", "valves on top of the cylinder heads"],
  piston: ["piston rings on the piston crown", "left half of the drawing", "right half of the drawing"],
};

/** curated fallback boxes (percent coords) — used per-slot when VLM is unusable */
const FALLBACK: Record<string, { x: number; y: number; w: number; h: number }[]> = {
  locomotive: [
    { x: 34, y: 22, w: 38, h: 42 }, // engine hood (center)
    { x: 6, y: 18, w: 20, h: 42 }, // cab (left end)
    { x: 55, y: 62, w: 38, h: 30 }, // bogie (bottom)
  ],
  engine: [
    { x: 22, y: 18, w: 52, h: 48 }, // cylinder bank
    { x: 60, y: 6, w: 26, h: 24 }, // turbo
    { x: 14, y: 72, w: 30, h: 22 }, // oil pump
  ],
  cylinders: [
    { x: 18, y: 55, w: 64, h: 36 }, // pistons
    { x: 24, y: 12, w: 52, h: 24 }, // valves
  ],
  piston: [
    { x: 34, y: 8, w: 32, h: 18 }, // rings
    { x: 6, y: 30, w: 34, h: 58 }, // left
    { x: 60, y: 30, w: 34, h: 58 }, // right
  ],
};

interface Box { x: number; y: number; w: number; h: number }

function normalizeJson(text: string): string {
  return text
    .replace(/```json|```/g, "")
    // quote bare object keys: {x: 1, y:2} -> {"x": 1, "y":2}
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":');
}

function extractBoxObjects(text: string): Record<string, number>[] {
  const cleaned = normalizeJson(text);
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr)) return arr.filter((o) => o && typeof o === "object");
  } catch { /* try object-by-object regex */ }
  const objs: Record<string, number>[] = [];
  const re = /\{[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    try { objs.push(JSON.parse(m[0])); } catch { /* skip */ }
  }
  return objs;
}

function toPercent(box: Record<string, number>, W: number, H: number): Box | null {
  let { x, y, w, h } = box;
  if ([x, y, w, h].some((v) => typeof v !== "number" || isNaN(v))) return null;
  // model answered in pixels? convert using real dimensions
  if (x > 100 || y > 100 || w > 100 || h > 100 || x + w > 105 || y + h > 105) {
    x = (x / W) * 100;
    y = (y / H) * 100;
    w = (w / W) * 100;
    h = (h / H) * 100;
  }
  if (w <= 0 || h <= 0) return null;
  // sanity: minimum plausible size in percent
  if (w < 4 || h < 4) return null;
  return clampBox({ x, y, w, h });
}

function clampBox(b: Box): Box {
  // expand ~20% for comfortable clicking, then clamp to canvas
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  let w = Math.max(b.w * 1.2, 12);
  let h = Math.max(b.h * 1.2, 12);
  let x = Math.max(0, Math.min(Math.max(100 - w, 0), cx - w / 2));
  let y = Math.max(0, Math.min(Math.max(100 - h, 0), cy - h / 2));
  w = Math.min(w, 100 - x);
  h = Math.min(h, 100 - y);
  return { x: r1(x), y: r1(y), w: r1(w), h: r1(h) };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

async function main() {
  const zai = await ZAI.create();
  const final: Record<string, Box[]> = {};

  for (const [key, parts] of Object.entries(TARGETS)) {
    const imgPath = path.join(DEMO_DIR, `${key}.png`);
    const buf = fs.readFileSync(imgPath);
    const meta = await sharp(buf).metadata();
    const W = meta.width || 1344;
    const H = meta.height || 768;
    const b64 = buf.toString("base64");

    const list = parts.map((p, i) => `${i + 1}. ${p}`).join("\n");
    const prompt = `Technical illustration. Locate each part:
${list}

Answer with ONLY a JSON array (no prose, no markdown) with one object per part, same order:
[{"x": <number>, "y": <number>, "w": <number>, "h": <number>}]
IMPORTANT: x and y are the top-left corner of the part's bounding box, w and h are its size, and ALL FOUR VALUES ARE PERCENTAGES of the image dimensions, between 0 and 100. Do not use pixels.`;

    let boxes: Box[] = [];
    try {
      const res = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      } as Parameters<typeof zai.chat.completions.createVision>[0]);
      const text = res.choices[0]?.message?.content || "";
      const objs = extractBoxObjects(text);
      boxes = objs.map((o) => toPercent(o, W, H)).filter((b): b is Box => b !== null);
      console.log(`= ${key}: ${boxes.length}/${parts.length} usable boxes from VLM (${W}x${H})`);
    } catch (e) {
      console.error(`! ${key}: VLM error -> fallback (${e instanceof Error ? e.message : e})`);
    }

    // fill missing slots from curated fallback
    const fb = FALLBACK[key];
    while (boxes.length < parts.length) {
      const idx = boxes.length;
      boxes.push(fb[Math.min(idx, fb.length - 1)]);
    }
    final[key] = boxes.slice(0, parts.length);
  }

  fs.writeFileSync(OUT, JSON.stringify(final, null, 2));
  console.log("SAVED", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
