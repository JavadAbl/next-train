import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [trainCount, nodeCount, areaCount, userCount, recordCount, monthRecords, typeGroups, recent] =
      await Promise.all([
        db.train.count({ where: { active: true } }),
        db.partNode.count(),
        db.area.count(),
        db.user.count({ where: { active: true } }),
        db.serviceRecord.count(),
        db.serviceRecord.count({ where: { date: { gte: monthStart } } }),
        db.serviceRecord.groupBy({ by: ["type"], _count: true }),
        db.serviceRecord.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          include: {
            repairman: { select: { fullName: true } },
            train: { select: { name: true } },
          },
        }),
      ]);

    const leafParts = Math.max(areaCount - Math.max(nodeCount - trainCount, 0), 0);
    const byType = Object.fromEntries(typeGroups.map((g) => [g.type, g._count]));

    return ok({
      stats: {
        trains: trainCount,
        leafParts,
        users: userCount,
        records: recordCount,
        monthRecords,
        byType,
      },
      recent,
    });
  } catch (err) {
    return handleError(err);
  }
}
