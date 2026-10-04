/* VLM visual check of the records filter card + Excel button (light & dark). */
import { readFileSync } from "fs";
import ZAI from "z-ai-web-dev-sdk";

const b64 = (p: string) => readFileSync(p).toString("base64");

const zai = await ZAI.create();
for (const [file, label] of [["/tmp/filters-light.png", "LIGHT"], ["/tmp/filters-dark.png", "DARK"]]) {
  const res = await zai.chat.completions.create({
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64(file)}` } },
          {
            type: "text",
            text: [
              "This is a Persian RTL service-records page. Check strictly and answer in English, briefly:",
              "1) Do any filter inputs/selects overlap or sink into each other? (labels: لوکوموتیو، نوع سرویس، تعمیرکار، تطبیق سریال، از تاریخ، تا تاریخ، جستجو)",
              "2) Are the three-select Jalali date pickers (روز/ماه/سال) fully readable, not clipped?",
              "3) Is there a green 'دانلود اکسل' button with an Excel-like icon, clearly visible?",
              "4) Any visual defect (clipped text, misalignment, elements outside the card)?",
              "Answer as: OVERLAP: yes/no | DATES: ok/issue | EXCEL-BTN: ok/issue | DEFECTS: none/list",
            ].join("\n"),
          },
        ],
      },
    ],
  });
  console.log(`=== ${label} ===`);
  console.log(res.choices[0]?.message?.content ?? "(no answer)");
}
