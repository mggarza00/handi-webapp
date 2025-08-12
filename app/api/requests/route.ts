import { NextResponse } from "next/server";
import { appendRequest, listRequests } from "@/lib/sheets";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const data = await listRequests(limit);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("[/api/requests] GET error", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("INVALID_JSON_BODY");

    const required = ["title", "description", "city", "category", "subcategory", "created_by"];
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return bad(`MISSING_FIELDS: ${missing.join(", ")}`);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const rowData = {
      id,
      title: String(body.title),
      description: String(body.description),
      city: String(body.city),
      category: String(body.category),
      subcategory: String(body.subcategory),
      budget: body.budget ?? "",
      required_at: body.required_at ?? "",
      status: body.status ?? "active",
      created_by: String(body.created_by),
      created_at: now,
      updated_at: now,
    };

    await appendRequest(rowData);
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    console.error("[/api/requests] POST error", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}