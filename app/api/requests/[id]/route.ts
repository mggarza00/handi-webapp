import { NextResponse } from "next/server";
import { getRequestById } from "@/lib/sheets";

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  try {
    const id = context.params?.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
    }
    const item = await getRequestById(id);
    if (!item) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: item });
  } catch (err: any) {
    console.error("[/api/requests/[id]] GET error", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
