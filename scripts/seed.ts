import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import fs from "fs";
import path from "path";
import { jalaliToDate } from "../src/lib/jalali";

const db = new PrismaClient();

const DEMO_DIR = path.join(process.cwd(), "assets", "demo");
const UPLOADS = path.join(process.cwd(), "public", "uploads");

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function copyImage(key: string): string {
  fs.mkdirSync(UPLOADS, { recursive: true });
  const dest = path.join(UPLOADS, `seed-${key}.png`);
  fs.copyFileSync(path.join(DEMO_DIR, `${key}.png`), dest);
  return `/uploads/seed-${key}.png`;
}

type Box = { x: number; y: number; w: number; h: number };
const boxes = JSON.parse(fs.readFileSync(path.join(DEMO_DIR, "boxes.json"), "utf-8")) as Record<string, Box[]>;

const TRAIN_NAME = "لوکوموتیو دیزل DL-500";

async function main() {
  // ---------- users ----------
  const users = [
    { username: "admin", password: "admin123", fullName: "مدیر سیستم", role: "ADMIN" },
    { username: "operator1", password: "op123456", fullName: "اپراتور نمونه — سارا احمدی", role: "OPERATOR" },
    { username: "repairman1", password: "rp123456", fullName: "مهدی کریمی", role: "REPAIRMAN" },
    { username: "repairman2", password: "rp123456", fullName: "علی رضایی", role: "REPAIRMAN" },
  ];
  for (const u of users) {
    const { password, ...rest } = u;
    await db.user.upsert({
      where: { username: u.username },
      create: { ...rest, passwordHash: hashPassword(password) },
      update: { fullName: u.fullName, role: u.role },
    });
  }
  const repairman1 = await db.user.findUniqueOrThrow({ where: { username: "repairman1" } });
  const repairman2 = await db.user.findUniqueOrThrow({ where: { username: "repairman2" } });
  console.log("users ready");

  // ---------- demo train ----------
  const FORCE = process.argv.includes("--force");
  const existing = await db.train.findFirst({ where: { name: TRAIN_NAME } });
  if (existing) {
    if (!FORCE) {
      console.log("demo train already seeded, skipping (use --force to reseed)");
      return;
    }
    // cascade removes nodes, areas and records of the old demo train
    await db.train.delete({ where: { id: existing.id } });
    console.log("old demo train deleted (--force)");
  }

  const train = await db.train.create({
    data: {
      name: TRAIN_NAME,
      model: "DL-500",
      serialNo: "IR-76-0500",
      description: "لوکوموتیو دیزلی شش‌محوره خط اصلی — نمونه نمایشی سامانه",
      nodes: { create: { name: "نمای کلی لوکوموتیو", image: copyImage("locomotive") } },
    },
  });
  const rootNode = await db.partNode.findFirstOrThrow({ where: { trainId: train.id, parentAreaId: null } });

  async function addArea(nodeId: string, name: string, box: Box) {
    const count = await db.area.count({ where: { nodeId } });
    return db.area.create({
      data: { nodeId, name, x: box.x, y: box.y, w: box.w, h: box.h, sortOrder: count },
    });
  }
  async function addNode(parentAreaId: string, name: string, image: string) {
    return db.partNode.create({ data: { trainId: train.id, name, image, parentAreaId } });
  }

  // level 1: locomotive overview
  const [locoEngine, locoBrake, locoCab] = boxes.locomotive;
  const areaEngine = await addArea(rootNode.id, "موتور دیزل", locoEngine);
  const areaBrake = await addArea(rootNode.id, "سیستم ترمز", locoBrake);
  const areaCab = await addArea(rootNode.id, "کابین راننده", locoCab);
  // level 2: diesel engine
  const engineNode = await addNode(areaEngine.id, "موتور دیزل", copyImage("engine"));
  const [engCyl, engTurbo, engPump] = boxes.engine;
  const areaCylinders = await addArea(engineNode.id, "سیلندرها", engCyl);
  const areaTurbo = await addArea(engineNode.id, "توربوشارژر", engTurbo);
  const areaPump = await addArea(engineNode.id, "پمپ روغن", engPump);

  // level 3: cylinders (valve band split into two areas)
  const cylindersNode = await addNode(areaCylinders.id, "سیلندرها", copyImage("cylinders"));
  const [cylPiston, cylValves] = boxes.cylinders;
  const areaPiston = await addArea(cylindersNode.id, "پیستون", cylPiston);
  const areaAirValve = await addArea(cylindersNode.id, "سوپاپ هوا", {
    x: cylValves.x, y: cylValves.y, w: cylValves.w / 2 - 1, h: cylValves.h,
  });
  const areaExhaustValve = await addArea(cylindersNode.id, "سوپاپ دود", {
    x: cylValves.x + cylValves.w / 2 + 1, y: cylValves.y, w: cylValves.w / 2 - 1, h: cylValves.h,
  });

  // level 4: piston
  const pistonNode = await addNode(areaPiston.id, "پیستون", copyImage("piston"));
  const [pistRings, pistLeft, pistRight] = boxes.piston;
  const areaLeftValve = await addArea(pistonNode.id, "سوپاپ چپ", pistLeft);
  const areaRightValve = await addArea(pistonNode.id, "سوپاپ راست", pistRight);
  const areaRings = await addArea(pistonNode.id, "رینگ پیستون", pistRings);

  // level 2: brake system (air brake equipment)
  const brakeNode = await addNode(areaBrake.id, "سیستم ترمز", copyImage("brake"));
  const [brkCompressor, brkReservoir, brkCylinder] = boxes.brake;
  const areaCompressor = await addArea(brakeNode.id, "کمپرسور هوا", brkCompressor);
  const areaReservoir = await addArea(brakeNode.id, "مخزن هوای فشرده", brkReservoir);
  const areaBrakeCylinder = await addArea(brakeNode.id, "سیلندر و کفشک ترمز", brkCylinder);

  // level 2: driver cab (interior)
  const cabNode = await addNode(areaCab.id, "کابین راننده", copyImage("cab"));
  const [cabWindshield, cabPanel, cabDesk] = boxes.cab;
  const areaWindshield = await addArea(cabNode.id, "شیشه جلو و برف‌پاک‌کن", cabWindshield);
  const areaGaugePanel = await addArea(cabNode.id, "تابلو دستگاه‌ها", cabPanel);
  const areaControlDesk = await addArea(cabNode.id, "اهرم فرمان و ترمز", cabDesk);
  console.log("hierarchy ready (6 nodes, 18 areas)");

  // ---------- sample records ----------
  const S = " › ";
  const PATH = {
    brakeCylinder: `${TRAIN_NAME}${S}سیستم ترمز${S}سیلندر و کفشک ترمز`,
    compressor: `${TRAIN_NAME}${S}سیستم ترمز${S}کمپرسور هوا`,
    reservoir: `${TRAIN_NAME}${S}سیستم ترمز${S}مخزن هوای فشرده`,
    gaugePanel: `${TRAIN_NAME}${S}کابین راننده${S}تابلو دستگاه‌ها`,
    controlDesk: `${TRAIN_NAME}${S}کابین راننده${S}اهرم فرمان و ترمز`,
    windshield: `${TRAIN_NAME}${S}کابین راننده${S}شیشه جلو و برف‌پاک‌کن`,
    turbo: `${TRAIN_NAME}${S}موتور دیزل${S}توربوشارژر`,
    pump: `${TRAIN_NAME}${S}موتور دیزل${S}پمپ روغن`,
    airValve: `${TRAIN_NAME}${S}سیلندرها${S}سوپاپ هوا`,
    exhaustValve: `${TRAIN_NAME}${S}سیلندرها${S}سوپاپ دود`,
    pistonRoot: `${TRAIN_NAME}${S}موتور دیزل${S}سیلندرها${S}پیستون`,
  };

  const records = [
    {
      areaId: areaLeftValve, path: `${PATH.pistonRoot}${S}سوپاپ چپ`, type: "REPLACEMENT",
      jy: 1405, jm: 4, jd: 12,
      description: "تعویض کامل سوپاپ چپ سیلندر شماره ۳ به دلیل خوردگی و نشتی گاز؛ قطعه اورجینال نصب و آب‌بندی شد.",
      partNumber: "V-4712", laborHours: 3.5, repairmanId: repairman1.id,
    },
    {
      areaId: areaLeftValve, path: `${PATH.pistonRoot}${S}سوپاپ چپ`, type: "VISIT",
      jy: 1405, jm: 6, jd: 28,
      description: "بازدید دوره‌ای پس از تعویض؛ فشار احتراق و عملکرد سوپاپ در محدوده مطلوب بود.",
      laborHours: 1, repairmanId: repairman2.id,
    },
    {
      areaId: areaRightValve, path: `${PATH.pistonRoot}${S}سوپاپ راست`, type: "REPAIR",
      jy: 1405, jm: 3, jd: 9,
      description: "تراش صفحه نشیمن و تنظیم فاصله سوپاپ راست سیلندر ۳ طبق مشخصات فنی کارخانه.",
      laborHours: 2, repairmanId: repairman1.id,
    },
    {
      areaId: areaRings, path: `${PATH.pistonRoot}${S}رینگ پیستون`, type: "REPLACEMENT",
      jy: 1405, jm: 1, jd: 25,
      description: "تعویض کامل ست رینگ‌های پیستون سیلندر ۳ به دلیل افت فشار احتراق و عبور روغن به محفظه احتراق.",
      partNumber: "PR-880", laborHours: 6, repairmanId: repairman1.id,
    },
    {
      areaId: areaPiston, path: `${PATH.pistonRoot}`, type: "VISIT",
      jy: 1405, jm: 5, jd: 5,
      description: "پایش عمومی سیلندرها و اندازه‌گیری لقی پیستون‌ها؛ همه پارامترها در حد مجاز.",
      laborHours: 1.5, repairmanId: repairman2.id,
    },
    {
      areaId: areaTurbo, path: PATH.turbo, type: "REPAIR",
      jy: 1405, jm: 5, jd: 21,
      description: "رفع نشتی روغن توربوشارژر، تعویض واشر و بالانس مجدد روتور.",
      laborHours: 4, repairmanId: repairman2.id,
    },
    {
      areaId: areaPump, path: PATH.pump, type: "REPLACEMENT",
      jy: 1405, jm: 2, jd: 17,
      description: "تعویض پمپ روغن اصلی موتور با قطعه اورجینال به دلیل افت فشار روغن در دور بالا.",
      partNumber: "OP-2290", laborHours: 5, repairmanId: repairman1.id,
    },
    {
      areaId: areaBrakeCylinder, path: PATH.brakeCylinder, type: "REPAIR",
      jy: 1405, jm: 6, jd: 3,
      description: "تعویض لنت‌های ترمز بوگی جلو و تنظیم مجدد فشار سیستم ترمز هوایی.",
      laborHours: 3, repairmanId: repairman2.id,
    },
    {
      areaId: areaGaugePanel, path: PATH.gaugePanel, type: "VISIT",
      jy: 1405, jm: 7, jd: 2,
      description: "بازدید تجهیزات کابین، تست گاویندگان و کالیبراسیون نمایشگرهای فشار و دما.",
      laborHours: 1.5, repairmanId: repairman1.id,
    },
    {
      areaId: areaCompressor, path: PATH.compressor, type: "REPAIR",
      jy: 1405, jm: 4, jd: 2,
      description: "تعویض فیلتر روغن و تنظیم شیر تخلیه کمپرسور هوا در سرویس دوره‌ای سیستم ترمز.",
      laborHours: 2, repairmanId: repairman1.id,
    },
    {
      areaId: areaReservoir, path: PATH.reservoir, type: "VISIT",
      jy: 1405, jm: 7, jd: 12,
      description: "تست نشتی شبکه هوای فشرده، تخلیه رطوبت مخزن و بازرسی شیر اطمینان.",
      laborHours: 1, repairmanId: repairman2.id,
    },
    {
      areaId: areaControlDesk, path: PATH.controlDesk, type: "REPAIR",
      jy: 1405, jm: 6, jd: 9,
      description: "تنظیم میکروسوئیچ‌های اهرم فرمان و روانکاری مفصل دسته فرمان.",
      laborHours: 1.5, repairmanId: repairman1.id,
    },
    {
      areaId: areaWindshield, path: PATH.windshield, type: "REPLACEMENT",
      jy: 1405, jm: 2, jd: 8,
      description: "تعویض تیغه‌های برف‌پاک‌کن شیشه جلو به دلیل فرسودگی لاستیک تیغه‌ها.",
      partNumber: "WP-330", laborHours: 0.5, repairmanId: repairman2.id,
    },
    {
      areaId: areaAirValve, path: PATH.airValve, type: "VISIT",
      jy: 1405, jm: 5, jd: 5,
      description: "تمیزکاری مسیر هوای ورودی و پایش عملکرد سوپاپ هوا.",
      laborHours: 1, repairmanId: repairman2.id,
    },
    {
      areaId: areaExhaustValve, path: PATH.exhaustValve, type: "REPAIR",
      jy: 1405, jm: 6, jd: 15,
      description: "رفع نشتی سوپاپ دود و آب‌بندی مجدد نشیمن سوپاپ.",
      laborHours: 2.5, repairmanId: repairman2.id,
    },
    {
      // later replacement on سوپاپ چپ: installed serial (V-4709) does NOT match last recorded (V-4712)
      areaId: areaLeftValve, path: `${PATH.pistonRoot}${S}سوپاپ چپ`, type: "REPLACEMENT",
      jy: 1405, jm: 8, jd: 20,
      description: "تعویض دوره‌ای سوپاپ چپ؛ هنگام بازکردن، کد سریال قطعه نصب‌شده (V-4709) با آخرین سریال ثبت‌شده سامانه (V-4712) مطابقت نداشت و عدم انطباق ثبت شد.",
      partNumber: "V-4800", removedSerial: "V-4709", serialMismatch: true,
      laborHours: 3, repairmanId: repairman2.id,
    },
    {
      // later replacement on رینگ پیستون: installed serial matches last recorded (PR-880)
      areaId: areaRings, path: `${PATH.pistonRoot}${S}رینگ پیستون`, type: "REPLACEMENT",
      jy: 1405, jm: 8, jd: 5,
      description: "تعویض دوره‌ای ست رینگ‌ها در بازسازی عمده؛ کد سریال قطعه نصب‌شده با آخرین سریال ثبت‌شده مطابقت داشت.",
      partNumber: "PR-890", removedSerial: "PR-880", serialMismatch: false,
      laborHours: 5.5, repairmanId: repairman1.id,
    },
  ];

  for (const r of records) {
    await db.serviceRecord.create({
      data: {
        trainId: train.id,
        areaId: r.areaId.id,
        path: r.path,
        type: r.type,
        date: jalaliToDate(r.jy, r.jm, r.jd),
        description: r.description,
        partNumber: r.partNumber || null,
        removedSerial: r.removedSerial || null,
        serialMismatch: r.serialMismatch || false,
        laborHours: r.laborHours ?? null,
        repairmanId: r.repairmanId,
      },
    });
  }
  console.log(`seeded ${records.length} service records`);
  console.log("SEED COMPLETE");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
