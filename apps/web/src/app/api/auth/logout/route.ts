import { NextResponse } from "next/server";
import { getEnv } from "@joeai/shared";

export const runtime = "nodejs";

export async function POST() {
  const env = getEnv();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(env.SESSION_COOKIE_NAME);
  return res;
}
