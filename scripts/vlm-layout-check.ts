import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

/** Ask VLM about the actual layout of each new realistic demo photo,
 *  so hotspot boxes can be calibrated to real part positions. */

const DEMO_DIR = path.join(process.cwd(), "assets", "demo");

const QUESTIONS: Record<string, string> = {
  locomotive: `This is a photo of a locomotive in a depot, used for an image-map UI.
Answer these questions about ACTUAL VISIBLE POSITIONS precisely, using image-percentage coordinates (x from left 0-100, y from top 0-100). Be concrete and terse:
1. Where is the driver cab (windshield end of the body): left end, right end, or center? Roughly which x-range (percent) does the cab occupy?
2. Where is the long engine hood (main body section): roughly which x-range and y-range (percent)?
3. Where are the bogies (wheeled assemblies under the frame): y-range (percent), and x-range of each bogie?
4. Does the photo actually look like a realistic photograph (not a drawing/render)? Any visible text or letters on the body?
Format: numbered plain answers, one line each.`,
  engine: `This is a photo of a large diesel engine in a workshop, used for an image-map UI.
Answer about ACTUAL VISIBLE POSITIONS with rough percent coordinates (x from left 0-100, y from top 0-100). Be concrete and terse:
1. Where is the main cylinder bank / valve cover block: x-range and y-range (percent)?
2. Where is the turbocharger (round housing on top): x-range and y-range (percent)? Is it clearly visible?
3. Where is the oil pump or lower crankcase front area: x-range and y-range (percent)? Is a pump-like component clearly visible at the bottom?
4. Realistic photo? Any text/letters visible?
Format: numbered plain answers, one line each.`,
  cylinders: `This is a photo of a diesel engine cylinder block on a bench, used for an image-map UI.
Answer about ACTUAL VISIBLE POSITIONS with rough percent coordinates (x from left 0-100, y from top 0-100). Be concrete and terse:
1. Where are the valve ports / valve seats / valvetrain parts: y-range (percent) and x-range?
2. Where are the pistons or cylinder bores visible: y-range (percent) and x-range?
3. Are both clearly distinguishable as separate top and bottom regions?
4. Realistic photo? Any text/letters visible?
Format: numbered plain answers, one line each.`,
  piston: `This is a photo of a piston assembly on a bench, used for an image-map UI.
Answer about ACTUAL VISIBLE POSITIONS with rough percent coordinates (x from left 0-100, y from top 0-100). Be concrete and terse:
1. Where is the piston (crown and body): x-range and y-range (percent)?
2. Are piston rings visible near the crown? Roughly which region?
3. Is there a valve on the LEFT side of the bench and a valve on the RIGHT side? Give rough x/y ranges of each.
4. Realistic photo? Any text/letters visible?
Format: numbered plain answers, one line each.`,
};

async function main() {
  const zai = await ZAI.create();
  for (const key of Object.keys(QUESTIONS)) {
    const p = path.join(DEMO_DIR, `${key}.png`);
    const b64 = fs.readFileSync(p).toString("base64");
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
      console.log(`\n================ ${key.toUpperCase()} ================`);
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
