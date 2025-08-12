// app/api/users/[id]/role/route.ts
import { NextResponse } from "next/server";
import { findUserRow, readUser, writeUser } from "@/lib/usersMapper";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { newRole?: "cliente" | "profesional" };
    const newRole = body?.newRole;
    if (newRole !== "cliente" && newRole !== "profesional") {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }

    const userId = (params.id || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
    }

    const rowIndex = await findUserRow(userId);
    if (rowIndex == null || rowIndex < 2) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const user = await readUser(rowIndex);
    const allowed = String(user.roles_permitidos || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Solo permite profesional si está autorizado
    if (newRole === "profesional" && !allowed.includes("profesional")) {
      return NextResponse.json({ ok: false, error: "ROLE_NOT_ALLOWED" }, { status: 403 });
    }

    await writeUser(rowIndex, { rol_actual: newRole });

    return NextResponse.json({
      ok: true,
      user: { ...user, rol_actual: newRole },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: err?.message },
      { status: 500 }
    );
  }
}
