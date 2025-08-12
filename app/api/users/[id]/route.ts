// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { findUserRow, readUser } from "@/lib/usersMapper";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = (params.id || "").trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
    }

    const rowIndex = await findUserRow(userId);
    // fila 1 = headers; datos desde la fila 2
    if (rowIndex == null || rowIndex < 2) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const user = await readUser(rowIndex);

    return NextResponse.json({
      ok: true,
      user: {
        rol_actual: user.rol_actual ?? "cliente",
        roles_permitidos: user.roles_permitidos ?? "cliente",
        // puedes exponer más campos si te sirven
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", details: err?.message },
      { status: 500 }
    );
  }
}
