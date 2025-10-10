"use client";
import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ServiceEvent = {
  date: string; // YYYY-MM-DD
  title: string;
  status: string;
  requestId: string;
  clientName?: string | null;
  city?: string | null;
};

export default function ServiceList({ events }: { events: ServiceEvent[] }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const list = React.useMemo(() => {
    return events
      .filter((e) => e.date >= todayKey)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [events, todayKey]);

  if (list.length === 0) {
    return <Card className="p-4 text-sm text-slate-600">No hay servicios agendados.</Card>;
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <ul className="space-y-3">
        {list.map((ev, i) => (
          <li key={`${ev.requestId}-${i}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{ev.title || "Servicio"}</span>
                    <Badge variant="secondary">{ev.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {ev.date}
                    {ev.city ? ` · ${ev.city}` : ""}
                    {ev.clientName ? ` · ${ev.clientName}` : " · Cliente"}
                  </p>
                </div>
                <div className="shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/requests/explore/${ev.requestId}`}>Ver solicitud</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

