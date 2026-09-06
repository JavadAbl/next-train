import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();

    const trains = await db.train.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, model: true, serialNo: true, description: true },
    });
    const ids = trains.map((t) => t.id);
    if (ids.length === 0) return ok({ trains: [] });

    const [roots, nodes, recordGroups] = await Promise.all([
      db.partNode.findMany({
        where: { trainId: { in: ids }, parentAreaId: null },
        select: { trainId: true, image: true },
      }),
      db.partNode.findMany({
        where: { trainId: { in: ids } },
        select: { trainId: true, _count: { select: { areas: true } } },
      }),
      db.serviceRecord.groupBy({
        by: ["trainId"],
        _count: true,
        where: { trainId: { in: ids } },
      }),
    ]);

    const rootByTrain = new Map(roots.map((r) => [r.trainId, r.image]));
    const recordByTrain = new Map(recordGroups.map((g) => [g.trainId, g._count]));
    const areasByTrain = new Map<string, number>();
    const nodesByTrain = new Map<string, number>();
    for (const n of nodes) {
      areasByTrain.set(n.trainId, (areasByTrain.get(n.trainId) || 0) + n._count.areas);
      nodesByTrain.set(n.trainId, (nodesByTrain.get(n.trainId) || 0) + 1);
    }

    return ok({
      trains: trains.map((t) => {
        const nodeCount = nodesByTrain.get(t.id) || 0;
        const areaCount = areasByTrain.get(t.id) || 0;
        // every non-root node is the child of exactly one area
        const leafParts = Math.max(areaCount - Math.max(nodeCount - 1, 0), 0);
        return {
          ...t,
          rootImage: rootByTrain.get(t.id) || null,
          nodeCount,
          areaCount,
          leafParts,
          recordCount: recordByTrain.get(t.id) || 0,
        };
      }),
    });
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "نام لوکوموتیو الزامی است"),
  model: z.string().trim().optional().nullable(),
  serialNo: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  rootName: z.string().trim().min(1, "نام سطح اول الزامی است"),
  imageUrl: z.string().min(1, "بارگذاری تصویر الزامی است"),
});

export async function POST(req: NextRequest) {
  try {
    await requireUser("ADMIN", "OPERATOR");
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "داده نامعتبر");

    const { name, model, serialNo, description, rootName, imageUrl } = parsed.data;
    const train = await db.train.create({
      data: {
        name,
        model: model || null,
        serialNo: serialNo || null,
        description: description || null,
        nodes: { create: { name: rootName, image: imageUrl } },
      },
      include: { nodes: { select: { id: true } } },
    });
    return ok({ train }, 201);
  } catch (err) {
    return handleError(err);
  }
}
