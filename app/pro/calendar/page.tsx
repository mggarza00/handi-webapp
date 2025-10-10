import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import PageContainer from "@/components/page-container";
import Breadcrumbs from "@/components/breadcrumbs";
import CalendarGrid from "@/components/pro-calendar/CalendarGrid";
import ServiceList from "@/components/pro-calendar/ServiceList";
import type { ScheduledService, CalendarEvent } from "@/components/pro-calendar/types";
import { fmtDateKey } from "@/lib/calendar/date";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const dynamic = "force-dynamic";

type AgreementRow = Database["public"]["Tables"]["agreements"]["Row"];
type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

async function getScheduled(
  supabase: any,
  userId: string,
): Promise<ScheduledService[]> {
  const since = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
  // 1) Intentar vista materializada / view si existe
  try {
    const { data: viewData, error: viewErr } = await supabase
      .from("v_pro_scheduled_services" as any)
      .select(
        "id,title,scheduled_at,scheduled_end_at,client_name,city,status,professional_id",
      )
      .eq("professional_id", userId)
      .gte("scheduled_at", since)
      .order("scheduled_at", { ascending: true, nullsFirst: false });
    if (!viewErr && Array.isArray(viewData) && viewData.length) {
      const mapped = (viewData as any[])
        .map((r) => ({
          id: String((r as any).id),
          title: (r as any).title ?? "Servicio",
          scheduled_at: String((r as any).scheduled_at ?? ""),
          scheduled_end_at: (r as any).scheduled_end_at ?? null,
          client_name: (r as any).client_name ?? null,
          city: (r as any).city ?? null,
          status: (r as any).status ?? null,
        }))
        .filter((x) => x.scheduled_at);
      return mapped as ScheduledService[];
    }
  } catch {
    // ignore
  }

  // 2) Fallback directo a requests: ajustar a columnas reales (scheduled_date/time)
  // 2.0) Intentar tabla pro_calendar_events si existe
  try {
    const { data: pce, error: pceErr } = await supabase
      .from('pro_calendar_events' as any)
      .select('request_id, pro_id, title, scheduled_date, scheduled_time, status')
      .eq('pro_id', userId)
      .order('scheduled_date', { ascending: true, nullsFirst: false });
    if (!pceErr && Array.isArray(pce) && pce.length) {
      const mapped: ScheduledService[] = (pce as any[])
        .map((r) => {
          const d = (r as any).scheduled_date as string | null;
          if (!d) return null;
          const t = (r as any).scheduled_time as string | null;
          const iso = `${d}${t ? `T${t}` : 'T09:00:00'}`;
          return {
            id: String((r as any).request_id),
            title: (r as any).title ?? 'Servicio',
            scheduled_at: iso,
            scheduled_end_at: null,
            client_name: null,
            city: null,
            status: (r as any).status ?? null,
          } as ScheduledService;
        })
        .filter((x): x is ScheduledService => !!x);
      if (mapped.length) return mapped;
    }
  } catch { /* ignore */ }

  try {
    // 2a) Intentar esquema con scheduled_at + service_name + client_name
    try {
      const { data: reqs2 } = (await supabase
        .from("requests")
        .select(
          "id,service_name,scheduled_at,scheduled_end_at,client_name,city,status,professional_id",
        )
        .eq("professional_id" as any, userId)
        .in("status" as any, ["scheduled", "in_process"]) // puede fallar si enum no contiene 'scheduled'
        .gte("scheduled_at" as any, since)
        .order("scheduled_at", { ascending: true, nullsFirst: false })) as unknown as {
        data: any[] | null;
      };
      const list2 = (reqs2 || []) as any[];
      if (list2.length) {
        const mapped: ScheduledService[] = list2
          .map((r) => ({
            id: String((r as any).id),
            title: (r as any).service_name ?? "Servicio",
            scheduled_at: String((r as any).scheduled_at ?? ""),
            scheduled_end_at: (r as any).scheduled_end_at ?? null,
            client_name: (r as any).client_name ?? null,
            city: (r as any).city ?? null,
            status: (r as any).status ?? null,
          }))
          .filter((x) => x.scheduled_at);
        if (mapped.length) return mapped;
      }
    } catch {
      // ignore and try legacy shape
    }

    const { data: reqs } = (await supabase
      .from("requests")
      .select(
        "id,title,city,status,scheduled_date,scheduled_time,professional_id",
      )
      .eq("professional_id" as any, userId)
      .order("scheduled_date", { ascending: true, nullsFirst: false })) as unknown as {
      data: any[] | null;
    };
    const list = (reqs || []) as any[];
    const services = list
      .map((r) => {
        const sd = (r as any).scheduled_date as string | null;
        if (!sd) return null;
        const st = (r as any).scheduled_time as string | null;
        const scheduled_at = `${sd}${st ? `T${st}` : "T09:00:00"}`;
        const obj = {
          id: String((r as any).id),
          title: (r as any).title ?? "Servicio",
          scheduled_at,
          scheduled_end_at: null,
          client_name: null,
          city: (r as any).city ?? null,
          status: (r as any).status ?? null,
        } as ScheduledService;
        return obj;
      })
      .filter((x): x is ScheduledService => !!x && !!x.scheduled_at);
    // Filtra estados relevantes si están presentes
    return services.filter((s) => {
      const st = (s.status || "").toLowerCase();
      return st ? st === "scheduled" || st === "in_process" : true;
    });
  } catch {
    return [];
  }
}

export default async function Page() {
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

  const services = await getScheduled(supabase, user.id);

  const calendarEvents: CalendarEvent[] = services.map((s) => ({
    ...s,
    dateKey: fmtDateKey(new Date(s.scheduled_at)),
  }));

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Calendario" }]} />
        <h1 className="text-2xl font-semibold mt-2">Mi calendario</h1>
        <p className="text-sm text-slate-600">Servicios pagados y agendados.</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 p-4">
          <CalendarGrid events={calendarEvents} />
        </Card>
        <Card className="lg:w-[380px] p-0">
          <ScrollArea className="h-[680px]">
            <div className="p-4">
              <ServiceList services={services} />
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
