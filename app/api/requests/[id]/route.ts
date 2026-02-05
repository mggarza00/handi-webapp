import { NextResponse } from "next/server";
import { z } from "zod";
import createClient from "@/utils/supabase/server";

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
  // Aceptar string o array; normalizar en handler
  conditions: z
    .union([z.string().max(240), z.array(z.string().min(2).max(40)).max(10)])
    .optional(),
  budget: z.number().nonnegative().nullable().optional(),
  required_at: z.string().datetime().optional(),
  attachments: z
    .array(z.union([AttachmentUrl, AttachmentPath]))
    .max(5)
    .optional(),
});

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id: rid } = params;
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
    const supabase = createClient();
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

    // Mask address for non-owners/non-assigned pros
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;
      let canSee = false;
      if (uid && data && (data as any)?.created_by === uid) canSee = true;
      if (!canSee && uid) {
        const reqStatus = String((data as any)?.status || "").toLowerCase();
        const paidishReq = new Set([
          "scheduled",
          "in_process",
          "inprogress",
          "paid",
          "completed",
          "finished",
        ]);
        const assignedProId =
          ((data as any)?.accepted_professional_id as string | undefined) ??
          ((data as any)?.professional_id as string | undefined) ??
          null;
        if (assignedProId && uid === assignedProId && paidishReq.has(reqStatus))
          canSee = true;
        if (!canSee) {
          // Check agreement link for assigned pro (paidish only)
          const { data: agr } = await supabase
            .from("agreements")
            .select("status")
            .eq("request_id", id.data)
            .eq("professional_id", uid)
            .limit(1);
          const agrStatus = Array.isArray(agr)
            ? String((agr[0] as any)?.status || "").toLowerCase()
            : "";
          if (
            ["paid", "in_progress", "completed", "finished"].includes(agrStatus)
          )
            canSee = true;
        }
      }
      if (!canSee) {
        const {
          address_line,
          address_place_id,
          address_lat,
          address_lng,
          ...rest
        } = (data || {}) as Record<string, unknown>;
        return NextResponse.json(
          { ok: true, data: rest },
          { status: 200, headers: JSONH },
        );
      }
    } catch {
      const {
        address_line,
        address_place_id,
        address_lat,
        address_lng,
        ...rest
      } = (data || {}) as Record<string, unknown>;
      return NextResponse.json(
        { ok: true, data: rest },
        { status: 200, headers: JSONH },
      );
    }

    return NextResponse.json(
      { ok: true, data },
      { status: 200, headers: JSONH },
    );
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
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { id: rid } = params;
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
    // Normaliza conditions si vienen
    const cond = parsed.data.conditions as unknown;
    if (typeof cond === "string" || Array.isArray(cond)) {
      let arr: string[] = [];
      if (typeof cond === "string") {
        arr = cond
          .split(",")
          .map((s) => s.replace(/\s+/g, " ").trim())
          .filter((s) => s.length > 0);
      } else {
        arr = cond
          .map((s) => (typeof s === "string" ? s : ""))
          .map((s) => s.replace(/\s+/g, " ").trim())
          .filter((s) => s.length >= 2 && s.length <= 40);
      }
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of arr) {
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
          if (out.length >= 10) break;
        }
      }
      let joined = out.join(", ");
      if (joined.length > 240) {
        while (joined.length > 240 && out.length > 0) {
          out.pop();
          joined = out.join(", ");
        }
      }
      (patch as Record<string, unknown>).conditions = joined;
    }
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
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );
    }

    const { id: rid } = params;
    const id = IdParam.safeParse(rid);
    if (!id.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: JSONH },
      );
    }

    // En lugar de borrar físicamente, marcar como cancelada para que aparezca en filtros "Canceladas"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("requests")
      .update({ status: "cancelled" })
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
