/**
 * Idempotent patch: add serial-verification demo records (mismatch + match)
 * to an ALREADY-SEEDED database (seed.ts skips when the demo train exists).
 *
 * Adds two REPLACEMENT records:
 *  - سوپاپ چپ:    removedSerial V-4709 ≠ last recorded V-4712  → serialMismatch = true
 *  - رینگ پیستون: removedSerial PR-880 = last recorded PR-880 → serialMismatch = false
 */
import { PrismaClient } from "@prisma/client";
import { jalaliToDate } from "../src/lib/jalali";

const db = new PrismaClient();

const TRAIN_NAME = "لوکوموتیو دیزل DL-500";
const S = " › ";
const MARKER = "عدم انطباق ثبت شد";

async function main() {
  const train = await db.train.findFirst({ where: { name: TRAIN_NAME } });
  if (!train) {
    console.log("demo train not found — run seed.ts first");
    return;
  }

  const existing = await db.serviceRecord.findFirst({
    where: { trainId: train.id, description: { contains: MARKER } },
  });
  if (existing) {
    console.log("serial demo records already exist, skipping");
    return;
  }

  const [leftValve, rings] = await Promise.all([
    db.area.findFirst({
      where: { name: "سوپاپ چپ", node: { trainId: train.id } },
    }),
    db.area.findFirst({
      where: { name: "رینگ پیستون", node: { trainId: train.id } },
    }),
  ]);
  if (!leftValve || !rings) {
    console.log("areas not found — seed hierarchy missing");
    return;
  }

  const repairman1 = await db.user.findUniqueOrThrow({ where: { username: "repairman1" } });
  const repairman2 = await db.user.findUniqueOrThrow({ where: { username: "repairman2" } });

  const pistonRoot = `${TRAIN_NAME}${S}موتور دیزل${S}سیلندرها${S}پیستون`;

  await db.serviceRecord.create({
    data: {
      trainId: train.id,
      areaId: leftValve.id,
      path: `${pistonRoot}${S}سوپاپ چپ`,
      type: "REPLACEMENT",
      date: jalaliToDate(1405, 8, 20),
      description:
        "تعویض دوره‌ای سوپاپ چپ؛ هنگام بازکردن، کد سریال قطعه نصب‌شده (V-4709) با آخرین سریال ثبت‌شده سامانه (V-4712) مطابقت نداشت و عدم انطباق ثبت شد.",
      partNumber: "V-4800",
      removedSerial: "V-4709",
      serialMismatch: true,
      laborHours: 3,
      repairmanId: repairman2.id,
    },
  });

  await db.serviceRecord.create({
    data: {
      trainId: train.id,
      areaId: rings.id,
      path: `${pistonRoot}${S}رینگ پیستون`,
      type: "REPLACEMENT",
      date: jalaliToDate(1405, 8, 5),
      description:
        "تعویض دوره‌ای ست رینگ‌ها در بازسازی عمده؛ کد سریال قطعه نصب‌شده با آخرین سریال ثبت‌شده مطابقت داشت.",
      partNumber: "PR-890",
      removedSerial: "PR-880",
      serialMismatch: false,
      laborHours: 5.5,
      repairmanId: repairman1.id,
    },
  });

  console.log("added 2 serial-verification demo records (1 mismatch, 1 match)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
