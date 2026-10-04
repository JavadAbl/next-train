import ZAI from "z-ai-web-dev-sdk";
import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Regenerate the 4 demo hierarchy diagrams as REALISTIC PHOTOGRAPHS
 * (replacing the vintage engineering-print style).
 * Overwrites assets/demo/*.png — old versions remain in git history.
 *
 * Composition is constrained so the hotspot structure keeps making sense:
 *  - locomotive: cab at LEFT end, long engine hood CENTER, bogies BOTTOM
 *  - engine:     cylinder bank CENTER, turbocharger TOP, oil pump BOTTOM
 *  - cylinders:  valve ports TOP, pistons in bores BOTTOM
 *  - piston:     piston upright CENTER (rings at its crown TOP),
 *                two poppet valves LEFT and RIGHT on the bench
 */

const OUT_DIR = path.join(process.cwd(), "assets", "demo");

const STYLE =
  "photorealistic professional industrial photography, realistic workshop lighting, realistic metal surfaces with oil stains and wear, shallow depth of field, high detail, high quality, no text, no labels, no numbers, no letters, no watermark";

const IMAGES: { key: string; prompt: string }[] = [
  {
    key: "locomotive",
    prompt:
      "Perfect full side profile view of a large diesel-electric freight locomotive inside a maintenance depot, " +
      "driver cab with windshield at the LEFT end of the body, long engine hood covering the middle of the body, " +
      "two bogies with wheels and brake cylinders visible below the frame, catenary-free industrial hall background, " +
      STYLE,
  },
  {
    key: "engine",
    prompt:
      "Large locomotive V12 diesel engine standing on a workshop floor, straight-on front view, " +
      "cylinder bank with valve covers filling the CENTER of the frame, big turbocharger mounted on TOP of the engine, " +
      "oil pump with piping mounted at the BOTTOM front of the crankcase, mechanics tool cart in the background, " +
      STYLE,
  },
  {
    key: "cylinders",
    prompt:
      "Diesel engine cylinder head and block assembly on a heavy workshop bench, straight-on view. " +
      "The TOP half of the assembly shows the valve deck: several mushroom-shaped poppet valves with slender stems " +
      "and coil springs clearly recognizable, installed in the cylinder head. " +
      "The BOTTOM half shows two large cylinder bores with aluminum pistons visible inside the bores, " +
      "piston crowns with ring grooves facing the camera. " +
      STYLE,
  },
  {
    key: "piston",
    prompt:
      "Large diesel engine piston with connecting rod standing upright on a dark workshop bench, centered, " +
      "shiny piston rings clearly visible in grooves at the TOP crown of the piston, " +
      "one engine poppet valve lying on the bench at the LEFT side and another poppet valve at the RIGHT side, " +
      STYLE,
  },
  {
    key: "cab",
    prompt:
      "Interior of a diesel locomotive driver cab photographed straight-on from the cab doorway toward the front: " +
      "large windshield with two windshield wipers at the TOP third of the frame, " +
      "instrument panel with round analog pressure gauges and toggle switches mounted in the MIDDLE band between windshield and desk, " +
      "main control desk with the train brake lever and throttle handle at the BOTTOM third of the frame, " +
      STYLE,
  },
  {
    key: "brake",
    prompt:
      "Three separate pieces of locomotive air brake equipment standing in a neat horizontal row on a workshop floor, " +
      "clearly separated with visible floor gaps between them, each piece occupying about one third of the frame width: " +
      "an electric-motor-driven air compressor with cooling fins on the LEFT third, " +
      "a horizontal cylindrical air reservoir tank standing on support cradles in the MIDDLE third, " +
      "a brake cylinder with push rod, linkage and brake shoes on the RIGHT third, " +
      "flat straight-on composition, all three pieces at the same distance from the camera, " +
      STYLE,
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // optional CLI args: only regenerate the given keys, e.g. `bun scripts/gen-realistic-demo.ts cylinders`
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const targets = only.length ? IMAGES.filter((i) => only.includes(i.key)) : IMAGES;
  const zai = await ZAI.create();

  for (const img of targets) {
    const outPath = path.join(OUT_DIR, `${img.key}.png`);
    let done = false;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({
          prompt: img.prompt,
          size: "1344x768" as "1344x768",
        });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error("empty response");
        const buf = Buffer.from(b64, "base64");
        if (buf.length < 50000) throw new Error("suspiciously small image");
        // validate it is a real decodable raster of the right aspect
        const meta = await sharp(buf).metadata();
        if (!meta.width || !meta.height) throw new Error("undecodable image");
        if (Math.abs(meta.width / meta.height - 16 / 9) > 0.05) {
          throw new Error(`bad aspect ${meta.width}x${meta.height}`);
        }
        fs.writeFileSync(outPath, buf);
        console.log(
          `+ ${img.key}: generated ${meta.width}x${meta.height} (${Math.round(buf.length / 1024)} KB)`
        );
        done = true;
      } catch (e) {
        console.error(
          `! attempt ${attempt} failed for ${img.key}: ${e instanceof Error ? e.message : e}`
        );
        if (attempt < 4) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    if (!done) throw new Error(`FAILED to generate ${img.key}`);
  }
  console.log("ALL REALISTIC IMAGES DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
