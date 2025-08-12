// app/api/professionals/applications/route.ts
import { NextResponse } from "next/server";
import { findUserRow, readUser, writeUser } from "@/lib/usersMapper";
import { logError } from "@/lib/log";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

// GET /api/professionals/applications?userId=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get("userId") || "").trim();
    const schema = z.object({ userId: z.string().min(1, "userId is required") });
    const parse = schema.safeParse({ userId });
    if (!parse.success) {
      console.warn("[GET /api/professionals/applications] Validation error", parse.error.issues);
      return NextResponse.json({ ok: false, error: parse.error.issues.map((e: any) => e.message) }, { status: 400 });
    }

    const rowIndex = await findUserRow(userId);
    if (rowIndex == null || rowIndex < 2) {
      console.warn(`[GET /api/professionals/applications] USER_NOT_FOUND for userId=${userId}`);
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const data = await readUser(rowIndex);
    return NextResponse.json({
      ok: true,
      status: (data.status_profesional as any) ?? "no_iniciado",
      step: Number(data.application_step ?? 0),
    });
  } catch (err: any) {
  logError("/api/professionals/applications", "GET error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: err?.message },
      { status: 500 }
    );
  }
}

// POST /api/professionals/applications  body: { userId: string }
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    const schema = z.object({ userId: z.string().min(1, "userId is required") });
    const parse = schema.safeParse({ userId: (body?.userId || "").trim() });
    if (!parse.success) {
      console.warn("[POST /api/professionals/applications] Validation error", parse.error.issues);
      return NextResponse.json({ ok: false, error: parse.error.issues.map((e: any) => e.message) }, { status: 400 });
    }
    const userId = parse.data.userId;

    const rowIndex = await findUserRow(userId);
    if (rowIndex == null || rowIndex < 2) {
      console.warn(`[POST /api/professionals/applications] USER_NOT_FOUND for userId=${userId}`);
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    await writeUser(rowIndex, { status_profesional: "en_proceso", application_step: 1 });

    return NextResponse.json({ ok: true, status: "en_proceso", step: 1 });
  } catch (err: any) {
  logError("/api/professionals/applications", "POST error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: err?.message },
      { status: 500 }
    );
  }
}
