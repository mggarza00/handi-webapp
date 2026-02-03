import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { assertAdminOrJson } from "@/lib/auth-admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await assertAdminOrJson();
  if (!guard.ok) return guard.res;
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("pro_applications")
      .select(
        [
          "id",
          "user_id",
          "full_name",
          "phone",
          "email",
          "rfc",
          "empresa",
          "is_company",
          "company_legal_name",
          "company_industry",
          "company_employees_count",
          "company_website",
          "company_doc_incorporation_url",
          "company_csf_url",
          "company_rep_id_front_url",
          "company_rep_id_back_url",
          "services_desc",
          "cities",
          "categories",
          "subcategories",
          "years_experience",
          "refs",
          "uploads",
          "status",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("id", params.id)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: JSONH },
      );
    if (!data)
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    return NextResponse.json(
      { ok: true, data },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function POST() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
