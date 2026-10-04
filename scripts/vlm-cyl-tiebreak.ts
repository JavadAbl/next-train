import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

/** Tie-breaker: neutral top-to-bottom description of the cylinders photo. */

async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(path.join(process.cwd(), "assets", "demo", "cylinders.png")).toString("base64");
  const q = `Describe this industrial photo strictly from TOP to BOTTOM, in order. Do not assume anything.
1. What exactly is visible in the TOP 25% of the frame?
2. What exactly is visible between 25% and 50% height?
3. What exactly is visible between 50% and 75% height?
4. What exactly is visible in the BOTTOM 25%?
5. Are there mushroom-shaped poppet valves with stems anywhere? At what height (top/middle/bottom)?
6. Are there round cylinder bores (large circular holes) or piston crowns (round metal discs) anywhere? At what height (top/middle/bottom)?
Be literal and terse.`;
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
    thinking: { type: "enabled" },
  });
  console.log(res.choices[0]?.message?.content ?? "(no answer)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
