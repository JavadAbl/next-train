import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
