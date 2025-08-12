import { NextResponse } from "next/server";
import { findUserRow, writeUser } from "@/lib/usersMapper";
import { logError } from "@/lib/log";
import { z } from "zod";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      step: z.number().int().min(0, "step must be >= 0"),
    });
    // Permitir step como string numérico
    const parsedStep = typeof body.step === 'string' ? Number(body.step) : body.step;
    const parse = schema.safeParse({ userId: body.userId, step: parsedStep });
    if (!parse.success) {
      console.warn("[PATCH /api/professionals/applications/step] Validation error", parse.error.issues);
      return NextResponse.json({ ok: false, error: parse.error.issues.map((e: any) => e.message) }, { status: 400 });
    }
    const { userId, step } = parse.data;
    const rowIndex = await findUserRow(userId);
    if (!rowIndex || rowIndex < 2) {
      console.warn(`[PATCH /api/professionals/applications/step] USER_NOT_FOUND for userId=${userId}`);
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }
    await writeUser(rowIndex, { application_step: step });
    return NextResponse.json({ ok: true, step });
  } catch (err: any) {
  logError("/api/professionals/applications/step", "PATCH error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: err?.message },
      { status: 500 }
    );
  }
}
