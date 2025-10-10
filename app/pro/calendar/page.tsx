import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import PageContainer from "@/components/page-container";
import Breadcrumbs from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import ProCalendarClient from "./pro-calendar.client";

export const dynamic = "force-dynamic";

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];

export default async function ProCalendarPage() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
  if (role !== "pro") redirect("/");

  const { data: offers, error } = await supabase
    .from("offers")
    .select("id, title, service_date, status, conversation_id")
    .eq("professional_id", user.id)
    .not("service_date", "is", null)
    .in("status", ["paid", "in_progress"] as any)
    .order("service_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const list = (offers ?? []) as Pick<
    OfferRow,
    "id" | "title" | "service_date" | "status" | "conversation_id"
  >[];
  const convIds = Array.from(
    new Set(
      list
        .map((o) => o.conversation_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  );

  let convMap = new Map<string, string | null>();
  if (convIds.length) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, request_id")
      .in("id", convIds);
    if (convs) convMap = new Map(convs.map((c) => [c.id, (c as any).request_id as string | null]));
  }

  const events = list
    .map((o) => ({
      offerId: o.id,
      title: o.title || "Servicio",
      status: (o.status as string) || "paid",
      date: (() => {
        try {
          const iso = (o.service_date as string) || "";
          // Normalize to YYYY-MM-DD using ISO date part
          return new Date(iso).toISOString().slice(0, 10);
        } catch {
          return "";
        }
      })(),
      requestId: o.conversation_id ? convMap.get(o.conversation_id) || null : null,
    }))
    .filter((e) => !!e.date && !!e.requestId);

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Calendario" }]} />
        <header>
          <h1 className="text-2xl font-semibold">Mi calendario</h1>
          <p className="text-sm text-slate-600">Servicios pagados y agendados.</p>
        </header>

        {error ? (
          <Card className="p-4 text-sm text-red-600">{error.message}</Card>
        ) : (
          <ProCalendarClient events={events} />
        )}
      </div>
    </PageContainer>
  );
}
