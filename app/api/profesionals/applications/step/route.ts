import { NextResponse } from "next/server";
import { findUserRow, writeUser } from "@/lib/usersMapper";

export async function PATCH(req: Request) {
  const { userId, step } = await req.json() as { userId: string, step: number };
  const rowIndex = await findUserRow(userId);
  if (!rowIndex) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  await writeUser(rowIndex, { application_step: step });
  return NextResponse.json({ ok: true, step });
}
