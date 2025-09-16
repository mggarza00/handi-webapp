import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const IdParam = z.string().uuid();
const AttachmentUrl = z.object({
  url: z.string().url(),
  mime: z.string(),
  size: z.number().max(5_000_000),
});
const AttachmentPath = z.object({
  path: z.string().min(3),
  mime: z.string(),
  size: z.number().max(5_000_000),
});

const PatchSchema = z.object({
  status: z.enum(["active", "in_process", "completed", "cancelled"]).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  city: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  subcategories: z.array(z.string()).max(6).optional(),
  budget: z.number().nonnegative().nullable().optional(),
  required_at: z.string().datetime().optional(),
  attachments: z
    .array(z.union([AttachmentUrl, AttachmentPath]))
    .max(5)
    .optional(),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rid } = await params;
  const id = IdParam.safeParse(rid);
  if (!id.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ID" },
      { status: 400, headers: JSONH },
    );
  }
  try {
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!hasEnv) {
      // Without Supabase config, avoid 500; behave as not found
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", detail: "No Supabase env" },
        { status: 404, headers: JSONH },
      );
    }
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id.data)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", detail: error.message },
        { status: 404, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true, data }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { id: rid } = await params;
    const id = IdParam.safeParse(rid);
    if (!id.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    }

    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: parsed.error.issues.map((i) => i.message),
        },
        { status: 400, headers: JSONH },
      );
    }

    const patch: Database["public"]["Tables"]["requests"]["Update"] = {
      ...parsed.data,
    } as Database["public"]["Tables"]["requests"]["Update"];
    if (parsed.data.required_at)
      patch.required_at = parsed.data.required_at.split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("requests")
      .update(patch)
      .eq("id", id.data)
      .select("*")
      .single();

    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json(
        {
          ok: false,
          error: "UPDATE_FAILED",
          detail: error.message,
          user_id: userId,
        },
        { status, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, data },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status, headers: JSONH },
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { id: rid } = await params;
    const id = IdParam.safeParse(rid);
    if (!id.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const { error } = await supabase
      .from("requests")
      .delete()
      .eq("id", id.data)
      .eq("created_by", userId)
      .single();
    if (error) {
      const status = /permission|rls/i.test(error.message) ? 403 : 400;
      return NextResponse.json(
        { ok: false, error: "DELETE_FAILED", detail: error.message },
        { status, headers: JSONH },
      );
    }
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status, headers: JSONH },
    );
  }
}
