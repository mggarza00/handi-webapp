import { NextRequest, NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: NextRequest) {
  try {
    const supabase = getRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    // 1) Intentar pro_calendar_events
    try {
      const { data, error } = await (supabase as any)
        .from("pro_calendar_events")
        .select(
          "request_id, pro_id, title, scheduled_date, scheduled_time, status",
        )
        .eq("pro_id", user.id)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      if (!error && Array.isArray(data) && data.length) {
        const requestIds = data
          .map((row: any) => row?.request_id)
          .filter((id: unknown) => typeof id === "string" && id.length);
        const requestsMap = new Map<
          string,
          {
            title: string | null;
            city: string | null;
            created_by: string | null;
          }
        >();
        const profilesMap = new Map<string, string | null>();
        if (requestIds.length) {
          const { data: reqRows } = await (supabase as any)
            .from("requests")
            .select("id, title, city, created_by")
            .in("id", requestIds);
          if (Array.isArray(reqRows)) {
            reqRows.forEach((r: any) => {
              requestsMap.set(String(r.id), {
                title: typeof r.title === "string" ? r.title : null,
                city: typeof r.city === "string" ? r.city : null,
                created_by:
                  typeof r.created_by === "string" ? r.created_by : null,
              });
            });
            const userIds = reqRows
              .map((r: any) => r?.created_by)
              .filter((id: unknown) => typeof id === "string" && id.length);
            if (userIds.length) {
              const { data: profRows } = await (supabase as any)
                .from("profiles")
                .select("id, full_name")
                .in("id", userIds);
              if (Array.isArray(profRows)) {
                profRows.forEach((p: any) => {
                  profilesMap.set(
                    String(p.id),
                    typeof p.full_name === "string" ? p.full_name : null,
                  );
                });
              }
            }
          }
        }
        const items = data.map((row: any) => {
          const req = requestsMap.get(String(row.request_id)) ?? null;
          const clientName = req?.created_by
            ? (profilesMap.get(String(req.created_by)) ?? null)
            : null;
          return {
            ...row,
            title: req?.title || row?.title || "Servicio",
            city: req?.city ?? null,
            client_name: clientName,
          };
        });
        return NextResponse.json(
          { ok: true, source: "pro_calendar_events", items },
          { status: 200, headers: JSONH },
        );
      }
    } catch {
      /* ignore */
    }

    // 2) Fallback directo a requests (compatible con professional_id o accepted_professional_id)
    try {
      // prefer accepted_professional_id si existe; caso contrario professional_id
      let { data, error } = await (supabase as any)
        .from("requests")
        .select(
          "id, title, status, scheduled_date, scheduled_time, accepted_professional_id, created_by, city",
        )
        .eq("accepted_professional_id", user.id)
        .in("status", ["scheduled", "in_process"]);
      if (error) {
        const alt = await (supabase as any)
          .from("requests")
          .select(
            "id, title, status, scheduled_date, scheduled_time, professional_id, created_by, city",
          )
          .eq("professional_id", user.id)
          .in("status", ["scheduled", "in_process"]);
        data = alt.data;
      }
      const userIds = Array.isArray(data)
        ? data
            .map((r: any) => r?.created_by)
            .filter((id: unknown) => typeof id === "string" && id.length)
        : [];
      let profilesMap = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profRows } = await (supabase as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (Array.isArray(profRows)) {
          profRows.forEach((p: any) => {
            profilesMap.set(
              String(p.id),
              typeof p.full_name === "string" ? p.full_name : null,
            );
          });
        }
      }
      const items = (data || []).map((r: any) => ({
        request_id: r.id,
        pro_id: user.id,
        title: r.title || "Servicio",
        scheduled_date: r.scheduled_date || null,
        scheduled_time: r.scheduled_time || null,
        status: r.status || null,
        city: r.city || null,
        client_name:
          r.created_by && profilesMap.has(String(r.created_by))
            ? profilesMap.get(String(r.created_by))
            : null,
      }));
      return NextResponse.json(
        { ok: true, source: "requests", items },
        { status: 200, headers: JSONH },
      );
    } catch {
      /* ignore */
    }

    return NextResponse.json(
      { ok: true, source: "empty", items: [] },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
