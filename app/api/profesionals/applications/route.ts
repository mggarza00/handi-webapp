import { NextResponse } from "next/server";
import { findUserRow, readUser, writeUser } from "@/lib/usersMapper";

export async function POST(req: Request) {
  const { userId } = await req.json() as { userId: string };
  const rowIndex = await findUserRow(userId);
  if (!rowIndex) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  await writeUser(rowIndex, { status_profesional: "en_proceso", application_step: 1 });
  return NextResponse.json({ ok: true, status: "en_proceso", step: 1 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "";
  const rowIndex = await findUserRow(userId);
  if (!rowIndex) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const data = await readUser(rowIndex);
  return NextResponse.json({
    ok: true,
    status: data.status_profesional || "no_iniciado",
    step: Number(data.application_step || 0),
  });
}
