"use client";
import * as React from "react";
import Link from "next/link";
import { SingleCalendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Event = {
  offerId: string;
  title: string;
  status: string;
  date: string; // YYYY-MM-DD
  requestId: string | null;
};

export default function ProCalendarClient({ events }: { events: Event[] }) {
  const map = React.useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const ev of events) {
      const key = ev.date;
      const arr = m.get(key) || [];
      arr.push(ev);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  const allDates = React.useMemo(() => Array.from(map.keys()).sort(), [map]);
  const initial = React.useMemo(() => {
    if (allDates.length) {
      const [y, m, d] = allDates[0].split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [allDates]);

  const [selected, setSelected] = React.useState<Date | undefined>(initial);

  const selectedKey = React.useMemo(() => {
    if (!selected) return "";
    return `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`;
  }, [selected]);

  const selectedEvents = map.get(selectedKey) || [];

  // Build modifiers from event dates
  const modifierDates = React.useMemo(() => {
    return allDates.map((k) => {
      const [y, m, d] = k.split("-").map((n) => parseInt(n, 10));
      return new Date(y, m - 1, d);
    });
  }, [allDates]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-3">
        <SingleCalendar
          selected={selected}
          onSelect={(d) => setSelected(d || undefined)}
          fromYear={new Date().getFullYear() - 1}
          toYear={new Date().getFullYear() + 1}
          className="w-full"
          modifiers={{ hasEvent: modifierDates }}
          modifiersClassNames={{
            hasEvent:
              'relative after:content-["\""] after:absolute after:left-1/2 after:-translate-x-1/2 after:bottom-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary',
          }}
        />
      </Card>
      <div className="space-y-3">
        <h2 className="text-base font-medium">Eventos del día</h2>
        {!selectedEvents.length ? (
          <Card className="p-4 text-sm text-slate-600">No tienes servicios agendados para este día.</Card>
        ) : (
          <ul className="space-y-3">
            {selectedEvents.map((ev) => (
              <li key={ev.offerId}>
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{ev.title || "Servicio"}</span>
                        <Badge variant="secondary">{ev.status}</Badge>
                      </div>
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
        )}
      </div>
    </div>
  );
}
