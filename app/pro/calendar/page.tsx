import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import createClient from "@/utils/supabase/server";

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

async function getScheduledFromApi(cookieHeader: string | null): Promise<ScheduledService[]> {
  try {
    const url = new URL('/api/pro/calendar', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
      next: { tags: ['pro-calendar'] },
    });
    const j = await res.json().catch(() => ({}));
    const items = Array.isArray(j?.items) ? j.items : [];
    const out: ScheduledService[] = items
      .map((r: any) => {
        const sd = r.scheduled_date as string | null;
        if (!sd) return null;
        const st = r.scheduled_time as string | null;
        const scheduled_at = `${sd}${st ? `T${st}` : 'T09:00:00'}`;
        return {
          id: String(r.request_id),
          title: (r.title as string) || 'Servicio',
          scheduled_at,
          scheduled_end_at: null,
          client_name: null,
          city: null,
          status: (r.status as string | null) ?? null,
        } as ScheduledService;
      })
      .filter((x: any) => !!x);
    return out as ScheduledService[];
  } catch { return []; }
}

export default async function Page() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<any>();
  const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
  if (role !== "pro") redirect("/");

  // Forward cookies to API so it can read auth and tag for revalidateTag
  const ck = cookies();
  const cookieHeader = ck.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  const services = await getScheduledFromApi(cookieHeader || null);

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
