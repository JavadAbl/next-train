import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return fail(err.message, err.status);
  console.error("[api]", err);
  return fail("خطای غیرمنتظره در سرور رخ داد", 500);
}
