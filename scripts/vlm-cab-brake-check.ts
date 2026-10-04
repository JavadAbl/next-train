import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

/** VLM layout check of the two NEW photos (cab interior, brake equipment). */

const DEMO_DIR = path.join(process.cwd(), "assets", "demo");

const QUESTIONS: Record<string, string> = {
  cab: `This is a photo of a locomotive driver cab interior, for an image-map UI. Image is 1344x768. Express positions as PERCENT (x from left 0-100, y from top 0-100). Answer tersely, one line each:
1. Where is the windshield (and are wipers visible): x% range and y% range?
2. Where is the instrument panel with round gauges: x% range and y% range? Are gauges clearly visible?
3. Where is the control desk with the throttle/brake levers: x% range and y% range? Are lever handles clearly visible?
4. Is the composition straight-on (not from an odd angle)? Any text/letters visible?`,
  brake: `This is a photo of locomotive air brake equipment in a workshop, for an image-map UI. Image is 1344x768. Express positions as PERCENT (x from left 0-100, y from top 0-100). Answer tersely, one line each:
1. Where is the air compressor (motor + compressor unit): x% range and y% range? Clearly recognizable?
2. Where is the cylindrical air reservoir tank: x% range and y% range? Clearly recognizable?
3. Where is the brake cylinder / brake shoes / linkage: x% range and y% range? Clearly recognizable?
4. Do the three components sit side by side (left / middle / right)? Any overlap in the photo? Any text/letters visible?`,
};

async function main() {
  const zai = await ZAI.create();
  for (const key of Object.keys(QUESTIONS)) {
    const b64 = fs.readFileSync(path.join(DEMO_DIR, `${key}.png`)).toString("base64");
    try {
      const res = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: QUESTIONS[key] },
              { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      });
      console.log(`\n============ ${key.toUpperCase()} ============`);
      console.log(res.choices[0]?.message?.content ?? "(no answer)");
    } catch (e) {
      console.error(`! VLM failed for ${key}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
