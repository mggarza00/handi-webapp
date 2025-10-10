"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScheduledService } from "./types";

export default function ServiceList({ services }: { services: ScheduledService[] }) {
  const router = useRouter();
  const todayKey = new Date().toISOString().slice(0, 10);
  const list = React.useMemo(() => {
    return services
      .filter((e) => (e.scheduled_at ? e.scheduled_at.slice(0, 10) >= todayKey : false))
      .slice()
      .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : 0));
  }, [services, todayKey]);

  if (list.length === 0) {
    return <div className="text-sm text-slate-600">No hay servicios agendados.</div>;
  }

  return (
    <ul className="space-y-3">
      {list.map((ev, i) => {
        const dt = ev.scheduled_at ? new Date(ev.scheduled_at) : null;
        const dateLabel = dt ? format(dt, "PPP", { locale: es }) : "";
        return (
          <li key={`${ev.id}-${i}`}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="truncate">{ev.title || "Servicio"}</span>
                  <Badge variant="secondary">{ev.status || "scheduled"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 text-xs text-slate-600">
                    <p>
                      {dateLabel}
                      {ev.city ? ` · ${ev.city}` : ""}
                      {ev.client_name ? ` · ${ev.client_name}` : " · Cliente"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/requests/explore/${ev.id}`)}>
                      Ver solicitud
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
