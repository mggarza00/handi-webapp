import { NextResponse } from "next/server";
import { findUserRow, readUser, writeUser } from "@/lib/usersMapper";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { newRole } = await req.json() as { newRole: "cliente" | "profesional" };
  const userId = params.id;

  const rowIndex = await findUserRow(userId);
  if (!rowIndex) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const user = await readUser(rowIndex);
  const allowed = (user.roles_permitidos || "").split(",").map(s => s.trim().toLowerCase());

  if (newRole === "profesional" && !allowed.includes("profesional")) {
    return NextResponse.json({ ok: false, error: "ROLE_NOT_ALLOWED" }, { status: 403 });
  }

  await writeUser(rowIndex, { rol_actual: newRole });
  return NextResponse.json({ ok: true });
}
