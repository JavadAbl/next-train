import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export interface TreeArea {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hasChild: boolean;
  childNode?: TreeNode | null;
}

export interface TreeNode {
  id: string;
  name: string;
  image: string;
  areas: TreeArea[];
}

/** GET full hierarchy tree for the builder (arbitrary depth). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;

    const train = await db.train.findUnique({ where: { id } });
    if (!train) return fail("لوکوموتیو یافت نشد", 404);

    const [nodes, areas] = await Promise.all([
      db.partNode.findMany({
        where: { trainId: id },
        select: { id: true, name: true, image: true, parentAreaId: true },
      }),
      db.area.findMany({
        where: { node: { trainId: id } },
        select: {
          id: true,
          nodeId: true,
          name: true,
          x: true,
          y: true,
          w: true,
          h: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const nodeByParentArea = new Map<string, typeof nodes[number]>();
    for (const n of nodes) if (n.parentAreaId) nodeByParentArea.set(n.parentAreaId, n);
    const areasByNode = new Map<string, typeof areas>();
    for (const a of areas) {
      const list = areasByNode.get(a.nodeId) || [];
      list.push(a);
      areasByNode.set(a.nodeId, list);
    }

    const buildNode = (nodeId: string, depth: number): TreeNode | null => {
      const n = nodeById.get(nodeId);
      if (!n || depth > 50) return null;
      const list = areasByNode.get(n.id) || [];
      return {
        id: n.id,
        name: n.name,
        image: n.image,
        areas: list.map((a) => {
          const child = nodeByParentArea.get(a.id);
          return {
            id: a.id,
            name: a.name,
            x: a.x,
            y: a.y,
            w: a.w,
            h: a.h,
            hasChild: !!child,
            childNode: child ? buildNode(child.id, depth + 1) : null,
          };
        }),
      };
    };

    const rootNode = nodes.find((n) => n.parentAreaId === null);
    if (!rootNode) return ok({ train, root: null });

    return ok({ train, root: buildNode(rootNode.id, 0) });
  } catch (err) {
    return handleError(err);
  }
}
