"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  monthGrid,
  fmtMonth,
  fmtDayNum,
  fmtDateKey,
  sameMonth,
  nextMonth,
  prevMonth,
} from "@/lib/calendar/date";
import type { CalendarEvent } from "./types";

export default function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const [cursor, setCursor] = React.useState<Date>(() => new Date());
  const router = useRouter();

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.dateKey;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const days = React.useMemo(() => monthGrid(cursor, 1).days, [cursor]);

  const todayKey = fmtDateKey(new Date());
  const headerMonth = `${fmtMonth(cursor)} ${cursor.getFullYear()}`;

  const dayName = (idx: number) => {
    // Monday-first abbrev: lu ma mi ju vi sá do
    const names = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
    return names[idx] || "";
  };

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor((d) => prevMonth(d))} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor((d) => nextMonth(d))} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-medium inline-flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <span>{headerMonth}</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-slate-600 mb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-1 text-center uppercase tracking-wide">
            {dayName(i)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = fmtDateKey(d);
          const list = byDay.get(key) || [];
          const inMonth = sameMonth(d, cursor);
          return (
            <div
              key={key}
              className={`h-28 rounded-2xl border p-2 overflow-hidden ${inMonth ? "bg-white" : "bg-neutral-50 opacity-40"}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{fmtDayNum(d)}</div>
                {key === todayKey ? (
                  <span className="inline-block rounded-full bg-blue-500 text-white text-[10px] px-1.5 py-0.5">hoy</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {list.slice(0, 3).map((ev, idx) => (
                  <button
                    key={`${ev.id}-${idx}`}
                    type="button"
                    onClick={() => router.push(`/requests/explore/${ev.id}`)}
                    className="w-full truncate rounded-xl bg-muted px-2 py-1 text-left text-xs hover:opacity-90"
                    title={ev.title || "Servicio"}
                    aria-label={ev.title || "Servicio"}
                  >
                    {ev.title || "Servicio"}
                  </button>
                ))}
                {list.length > 3 ? (
                  <Badge variant="outline" className="w-fit whitespace-nowrap text-[10px]">+{list.length - 3} más</Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
