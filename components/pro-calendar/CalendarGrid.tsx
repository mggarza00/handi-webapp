"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

import type { CalendarEvent } from "./types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  monthGrid,
  fmtMonth,
  fmtDayNum,
  fmtDateKey,
  sameMonth,
  nextMonth,
  prevMonth,
} from "@/lib/calendar/date";

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
          const isToday = key === todayKey;
          const dayNumberClass = `text-sm font-medium text-center sm:text-left ${isToday ? "text-blue-600" : ""}`;
          const boxBase = [
            "h-24",
            "rounded-2xl",
            "border",
            "p-2",
            "overflow-hidden",
            inMonth ? "bg-white" : "bg-neutral-50 opacity-40",
            isToday ? "border-2 border-blue-500" : "border-slate-200",
          ].join(" ");
          return (
            <div
              key={key}
              className={boxBase}
            >
              <div className="flex items-center justify-center sm:justify-between">
                <div className={dayNumberClass}>{fmtDayNum(d)}</div>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {list.slice(0, 3).map((ev, idx) => {
                  const name = (ev.title && ev.title.trim().length ? ev.title : "Servicio").trim();
                  return (
                    <Tooltip key={`${ev.id}-${idx}`}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => router.push(`/requests/explore/${ev.id}`)}
                          className="w-full truncate rounded-xl bg-muted px-2 py-1 text-left text-xs hover:opacity-90"
                          aria-label={name}
                        >
                          {name}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-[220px] text-xs">
                        {name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
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
