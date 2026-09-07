import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "assets", "demo");

const STYLE =
  "vintage engineering drawing style, precise technical line work, warm sepia and graphite ink on aged cream paper, clean background, no text, no labels, no numbers, no letters, centered composition, high quality, detailed";

const IMAGES: { key: string; prompt: string; size: string }[] = [
  {
    key: "locomotive",
    prompt: `Full side view of a large diesel freight locomotive with long hood body, wheels and bogies visible, ${STYLE}`,
    size: "1344x768",
  },
  {
    key: "engine",
    prompt: `Large V12 diesel engine block of a locomotive, three-quarter front view, turbocharger on top, front three-quarter view, ${STYLE}`,
    size: "1344x768",
  },
  {
    key: "cylinders",
    prompt: `Diesel engine cylinder bank, cutaway view showing six cylinder heads arranged in a row with bolts and valves, ${STYLE}`,
    size: "1344x768",
  },
  {
    key: "piston",
    prompt: `Engine piston assembly cutaway view, crown, piston rings, wrist pin and connecting rod clearly separated, ${STYLE}`,
    size: "1344x768",
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zai = await ZAI.create();

  for (const img of IMAGES) {
    const outPath = path.join(OUT_DIR, `${img.key}.png`);
    if (fs.existsSync(outPath)) {
      console.log(`= exists, skipping: ${img.key}`);
      continue;
    }
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: img.prompt, size: img.size as "1344x768" });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error("empty response");
        const buf = Buffer.from(b64, "base64");
        if (buf.length < 10000) throw new Error("suspiciously small image");
        fs.writeFileSync(outPath, buf);
        console.log(`+ generated: ${img.key} (${Math.round(buf.length / 1024)} KB)`);
        done = true;
      } catch (e) {
        console.error(`! attempt ${attempt} failed for ${img.key}: ${e instanceof Error ? e.message : e}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (!done) throw new Error(`FAILED to generate ${img.key}`);
  }
  console.log("ALL IMAGES DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
