import { NextRequest, NextResponse } from "next/server";

import createClient from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

type SavedAddressRow = Pick<
  Database["public"]["Tables"]["user_saved_addresses"]["Row"],
  | "label"
  | "address_line"
  | "address_place_id"
  | "lat"
  | "lng"
  | "last_used_at"
  | "times_used"
>;

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: NextRequest) {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      return NextResponse.json(
        { ok: true, data: [] },
        { status: 200, headers: JSONH },
      );
    }
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId)
      return NextResponse.json(
        { ok: true, data: [] },
        { status: 200, headers: JSONH },
      );

    const { data, error } = await supabase
      .from("user_saved_addresses")
      .select(
        "label,address_line,address_place_id,lat,lng,last_used_at,times_used",
      )
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false })
      .limit(10);
    if (error) {
      return NextResponse.json(
        { ok: true, data: [] },
        { status: 200, headers: JSONH },
      );
    }
    return NextResponse.json(
      { ok: true, data: data ?? [] },
      { status: 200, headers: JSONH },
    );
  } catch {
    return NextResponse.json(
      { ok: true, data: [] },
      { status: 200, headers: JSONH },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[addresses/saved] supabase_not_configured");
      }
      return NextResponse.json(
        { ok: false, error: "supabase_not_configured" },
        { status: 500, headers: JSONH },
      );
    }

    const ctype = req.headers.get("content-type") || "";
    if (!ctype.toLowerCase().includes("application/json")) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[addresses/saved] invalid_content_type");
      }
      return NextResponse.json(
        { ok: false, error: "invalid_content_type" },
        { status: 400, headers: JSONH },
      );
    }

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[addresses/saved] unauthorized");
      }
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: JSONH },
      );
    }

    const body = await req.json().catch(() => ({}));
    const address_line =
      typeof body?.address_line === "string" ? body.address_line.trim() : "";
    const address_place_id =
      typeof body?.address_place_id === "string"
        ? body.address_place_id.trim()
        : null;
    const lat =
      typeof body?.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : null;
    const lng =
      typeof body?.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : null;
    const label =
      typeof body?.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : null;

    if (!address_line) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[addresses/saved] address_line_required");
      }
      return NextResponse.json(
        { ok: false, error: "address_line_required" },
        { status: 422, headers: JSONH },
      );
    }

    const { data, error } = await supabase.rpc("upsert_user_address", {
      address_line,
      address_place_id,
      lat,
      lng,
      label,
    });

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[addresses/saved] rpc_failed", error);
      }
      return NextResponse.json(
        {
          ok: false,
          error: "rpc_failed",
          detail:
            (error as { message?: string; code?: string })?.message ||
            (error as { code?: string })?.code ||
            null,
        },
        { status: 400, headers: JSONH },
      );
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[addresses/saved] upsert success", data);
    }
    return NextResponse.json(
      { ok: true, id: data ?? null },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[addresses/saved] unknown", err);
    }
    return NextResponse.json(
      { ok: false, error: "unknown" },
      { status: 500, headers: JSONH },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
