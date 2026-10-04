import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const train = await db.train.findFirstOrThrow({ where: { name: "لوکوموتیو دیزل DL-500" } });
  const nodes = await db.partNode.findMany({
    where: { trainId: train.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`TRAIN: ${train.name} — ${nodes.length} nodes`);
  for (const n of nodes) {
    const areas = await db.area.findMany({
      where: { nodeId: n.id },
      orderBy: { sortOrder: "asc" },
    });
    console.log(`\nNODE "${n.name}" image=${n.image}`);
    for (const a of areas) {
      console.log(
        `  area "${a.name}": x=${a.x} y=${a.y} w=${a.w} h=${a.h} -> childArea=${areas.length ? "" : ""}${(a as unknown as { childNodeId?: string }).childNodeId ?? "-"}`
      );
    }
  }
  const recCount = await db.serviceRecord.count({ where: { trainId: train.id } });
  const mismatchCount = await db.serviceRecord.count({
    where: { trainId: train.id, serialMismatch: true },
  });
  console.log(`\nrecords: ${recCount} (mismatch: ${mismatchCount})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
