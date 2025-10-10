import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import PageContainer from "@/components/page-container";
import Breadcrumbs from "@/components/breadcrumbs";
import CalendarGrid from "@/components/pro-calendar/CalendarGrid";
import ServiceList from "@/components/pro-calendar/ServiceList";

export const dynamic = "force-dynamic";

type AgreementRow = Database["public"]["Tables"]["agreements"]["Row"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

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

  // 1) Agreements del profesional (compatibles con RLS)
  const { data: agreements } = await supabase
    .from("agreements")
    .select("id, request_id, status, created_at")
    .eq("professional_id", user.id)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const agrs = (agreements ?? []) as Pick<
    AgreementRow,
    "id" | "request_id" | "status" | "created_at"
  >[];
  const reqIds = Array.from(new Set(agrs.map((a) => a.request_id).filter(Boolean)));

  // 2) Requests para fechas y datos
  let reqMap = new Map<string, RequestRow & { scheduled_date?: string | null; scheduled_time?: string | null; address_city?: string | null; client_name?: string | null }>();
  if (reqIds.length) {
    const { data: reqs } = (await supabase
      .from("requests")
      .select("id,title,city,created_by,scheduled_date,scheduled_time,address_city")
      .in("id", reqIds)) as unknown as { data: any[] | null };
    const rows = (reqs || []) as any[];
    reqMap = new Map(rows.map((r) => [r.id as string, r as any]));
  }

  // 3) Eventos normalizados para la UI
  const events = agrs
    .map((a) => {
      const r = reqMap.get(a.request_id);
      const scheduled_date = (r as any)?.scheduled_date as string | null;
      const date = scheduled_date || null;
      if (!date) return null;
      const statusRaw = (a.status as unknown as string) || "";
      const status = statusRaw === "in_progress" ? "in_process" : "scheduled";
      const title = (r as any)?.title || "Servicio";
      const clientName = (r as any)?.client_name || null;
      const city = (r as any)?.address_city || (r as any)?.city || null;
      return { date, title, status, requestId: a.request_id, clientName, city };
    })
    .filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Calendario" }]} />
        <header>
          <h1 className="text-2xl font-semibold">Mi calendario</h1>
          <p className="text-sm text-slate-600">Servicios pagados y agendados.</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CalendarGrid events={events.map((e) => ({ date: e.date, title: e.title, status: e.status, requestId: e.requestId }))} />
          <ServiceList events={events} />
        </div>
      </div>
    </PageContainer>
  );
}
