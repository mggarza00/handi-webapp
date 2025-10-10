"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  addMonth,
  subMonth,
  monthGrid,
  fmtMonth,
  fmtDayNum,
  fmtDateKey,
  isSameMonthFn,
} from "@/lib/calendar/date";

export type CalendarEvent = {
  date: string; // YYYY-MM-DD
  title: string;
  status: string;
  requestId: string;
};

export default function CalendarGrid({ events }: { events: CalendarEvent[] }) {
  const [cursor, setCursor] = React.useState<Date>(() => new Date());

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const grid = React.useMemo(() => monthGrid(cursor, 1), [cursor]);

  const todayKey = fmtDateKey(new Date());
  const headerMonth = `${fmtMonth(cursor)} ${cursor.getFullYear()}`;

  const dayName = (idx: number) => {
    // Monday-first abbrev: lu ma mi ju vi sá do
    const names = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
    return names[idx] || "";
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor((d) => subMonth(d))}>
            ◀
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor((d) => addMonth(d))}>
            ▶
          </Button>
        </div>
        <div className="text-sm font-medium">
          {headerMonth}
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
        {grid.days.map((d) => {
          const key = fmtDateKey(d);
          const list = eventsByDay.get(key) || [];
          const inMonth = isSameMonthFn(d, cursor);
          return (
            <div
              key={key}
              className={`min-h-24 rounded-md border p-1 ${inMonth ? "bg-white" : "bg-neutral-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">{fmtDayNum(d)}</div>
                {key === todayKey ? (
                  <span className="inline-block rounded-full bg-blue-500 text-white text-[10px] px-1.5 py-0.5">hoy</span>
                ) : null}
              </div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 3).map((ev, idx) => (
                  <Link key={`${ev.requestId}-${idx}`} href={`/requests/explore/${ev.requestId}`}>
                    <Badge variant="secondary" className="w-full justify-start truncate">
                      {ev.title || "Servicio"}
                    </Badge>
                  </Link>
                ))}
                {list.length > 3 ? (
                  <Badge variant="outline" className="w-full justify-center">+{list.length - 3}</Badge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

