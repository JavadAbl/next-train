import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

/** Visual QA of the 4 navigator screenshots (realistic photos + overlaid hotspot rects). */

const SHOTS = path.join(process.cwd(), "assets", "screens");

const CHECKS: { file: string; prompt: string }[] = [
  {
    file: "v2-level1-locomotive.png",
    prompt:
      `This is a Persian RTL web app showing a realistic locomotive photo with 3 labeled rectangular hotspot areas drawn over it: «موتور دیزل» (diesel engine), «سیستم ترمز» (brake system), «کابین راننده» (driver cab).
Answer tersely:
1. Does the «موتور دیزل» box sit over the long engine hood section of the locomotive body? (yes/no + issue)
2. Does the «سیستم ترمز» box cover the wheeled bogies / under-frame area? (yes/no + issue)
3. Does the «کابین راننده» box sit over the cab end (windshield)? (yes/no + issue)
4. Do any hotspot rectangles overlap each other or hang outside the photo? Any label text overlapping another box?`,
  },
  {
    file: "v2-level2-engine.png",
    prompt:
      `This is a Persian RTL web app showing a realistic diesel engine photo with 3 labeled hotspot rectangles: «سیلندرها» (cylinders), «توربوشارژر» (turbocharger), «پمپ روغن» (oil pump).
Answer tersely:
1. Does «سیلندرها» sit over the main cylinder bank / valve covers of the engine? (yes/no + issue)
2. Does «توربوشارژر» sit over the turbocharger (round housing on top)? (yes/no + issue)
3. Does «پمپ روغن» sit over a pump/crankcase component at the bottom? (yes/no + issue)
4. Any overlapping boxes or misplaced labels?`,
  },
  {
    file: "v2-level3-cylinders.png",
    prompt:
      `This is a Persian RTL web app showing a realistic cylinder block photo with 3 labeled hotspot rectangles: «پیستون» (piston, bottom), «سوپاپ هوا» (air valve, top half), «سوپاپ دود» (exhaust valve, top half).
Answer tersely:
1. Does «پیستون» cover the piston/cylinder bores region? (yes/no + issue)
2. Do «سوپاپ هوا» and «سوپاپ دود» sit over the valve ports/valvetrain region at the top? (yes/no + issue)
3. Do the two valve boxes split the top region cleanly without overlapping each other or «پیستون»? (yes/no + issue)
4. Any label collisions or boxes outside the photo?`,
  },
  {
    file: "v2-level4-piston.png",
    prompt:
      `This is a Persian RTL web app showing a realistic piston photo with 3 labeled hotspot rectangles: «سوپاپ چپ» (left valve), «سوپاپ راست» (right valve), «رینگ پیستون» (piston rings).
Answer tersely:
1. Does «رینگ پیستون» sit over/near the ring grooves at the top crown of the piston? (yes/no + issue)
2. Does «سوپاپ چپ» cover the left-side valve on the bench? (yes/no + issue)
3. Does «سوپاپ راست» cover the right-side valve on the bench? (yes/no + issue)
4. Any overlapping boxes, label collisions, or areas hanging outside the photo?`,
  },
];

async function main() {
  const zai = await ZAI.create();
  for (const c of CHECKS) {
    const b64 = fs.readFileSync(path.join(SHOTS, c.file)).toString("base64");
    try {
      const res = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: c.prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      });
      console.log(`\n============ ${c.file} ============`);
      console.log(res.choices[0]?.message?.content ?? "(no answer)");
    } catch (e) {
      console.error(`! VLM failed for ${c.file}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
