import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_SEED !== "1") {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();

    // Pick a pro and a different client
    const { data: pro } = await admin.from("professionals").select("id").limit(1).maybeSingle();
    if (!pro) return NextResponse.json({ ok: false, error: "NO_PRO" }, { status: 400, headers: JSONH });
    const { data: client } = await admin
      .from("profiles")
      .select("id")
      .neq("id", pro.id)
      .limit(1)
      .maybeSingle();
    if (!client) return NextResponse.json({ ok: false, error: "NO_CLIENT" }, { status: 400, headers: JSONH });

    // Create three completed requests
    const reqs: string[] = [];
    for (const title of ["Pintura de living", "Arreglo eléctrico", "Colocación de estantes"]) {
      const { data: r, error } = await admin
        .from("requests")
        .insert([{ title, description: title, city: "CABA", status: "completed", created_by: client.id }])
        .select("id")
        .single();
      if (error || !r) return NextResponse.json({ ok: false, error: error?.message || "REQ_FAIL" }, { status: 400, headers: JSONH });
      reqs.push(r.id);
    }

    // Agreements for the pro
    const agIds: string[] = [];
    for (const rid of reqs) {
      const { data: a, error } = await admin
        .from("agreements")
        .insert([{ request_id: rid, professional_id: pro.id, status: "completed" }])
        .select("id")
        .single();
      if (error || !a) return NextResponse.json({ ok: false, error: error?.message || "AG_FAIL" }, { status: 400, headers: JSONH });
      agIds.push(a.id);
    }

    // Service photos (two requests)
    const photos = [
      { rid: reqs[0], aid: agIds[0], seeds: ["h1", "h2", "h3"] },
      { rid: reqs[1], aid: agIds[1], seeds: ["j1", "j2", "j3"] },
    ];
    for (const p of photos) {
      const rows = p.seeds.map((s) => ({
        offer_id: p.aid,
        request_id: p.rid,
        professional_id: pro.id,
        image_url: `https://picsum.photos/seed/${s}/800/600`,
      }));
      const { error } = await admin.from("service_photos").insert(rows);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
    }

    // Reviews (client -> pro) via view to trigger
    const comments = [
      "Excelente trabajo, prolijo y rápido.",
      "Muy bueno, a tiempo.",
      "Todo perfecto. Recomendado.",
    ];
    for (let i = 0; i < reqs.length; i++) {
      const { error } = await admin.from("reviews").insert([
        {
          request_id: reqs[i],
          client_id: client.id,
          professional_id: pro.id,
          rating: 4 + (i % 2),
          comment: comments[i],
        } as never,
      ]);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
    }

    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

