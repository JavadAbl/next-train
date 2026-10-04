import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

/** Focused follow-up on the locomotive photo: full body extent + right side + bogies. */

const DEMO_DIR = path.join(process.cwd(), "assets", "demo");

async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(path.join(DEMO_DIR, "locomotive.png")).toString("base64");
  const q = `This is a photo of a locomotive inside a depot. The image is 1344 pixels wide and 768 pixels tall. Express every position as PERCENT of image width/height (0-100), not pixels.
Answer tersely, one line each:
1. What is the horizontal extent of the whole locomotive body (from which x% to which x%)? And vertical extent of the body (y% range)?
2. What exactly occupies the RIGHT third of the image (x > 66%)? Body continuation, or workshop background?
3. The engine hood section (middle body, excluding cab): exact x% range and y% range.
4. The driver cab: exact x% range and y% range.
5. List EVERY wheeled bogie you can see with its x% range and y% range (there may be 2 or 3).
6. Any brake cylinders, pipes or brake equipment visible near the bogies or under-frame? Where (x%, y%)?`;
  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: q },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });
  console.log(res.choices[0]?.message?.content ?? "(no answer)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
