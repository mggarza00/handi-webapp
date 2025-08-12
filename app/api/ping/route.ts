import { NextResponse } from "next/server";

export async function GET() {
  const required = ["PROJECT_ID", "CLIENT_EMAIL", "PRIVATE_KEY", "SHEET_ID"];
  const missing = required.filter((k) => !process.env[k] || process.env[k] === "");

  return NextResponse.json({
    ok: missing.length === 0,
    env: missing.length ? { missing } : "all_set",
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
