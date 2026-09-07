import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, requestIsHttps } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  // Keep attributes consistent with the login cookie so Secure cookies can be cleared.
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(requestIsHttps(req)), maxAge: 0 });
  return res;
}
