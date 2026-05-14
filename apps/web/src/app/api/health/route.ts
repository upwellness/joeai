import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "joeai",
    timestamp: new Date().toISOString(),
  });
}
