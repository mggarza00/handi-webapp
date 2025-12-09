import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";
import { es } from "date-fns/locale";

export const fmtMonth = (d: Date) => format(d, "LLLL", { locale: es });
export const fmtDayNum = (d: Date) => format(d, "d", { locale: es });
export const fmtDateKey = (d: Date) => format(d, "yyyy-MM-dd");

export type MonthGrid = {
  days: Date[];
  monthStart: Date;
  monthEnd: Date;
};

export const monthGrid = (cursor: Date, weekStartsOn: 0 | 1 = 1): MonthGrid => {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  return { days, monthStart, monthEnd };
};

export const addMonth = (d: Date) => addMonths(d, 1);
export const subMonth = (d: Date) => subMonths(d, 1);
export const nextMonth = (d: Date) => addMonths(d, 1);
export const prevMonth = (d: Date) => subMonths(d, 1);
export const isSameDayFn = isSameDay;
export const isSameMonthFn = isSameMonth;
export const sameDay = isSameDay;
export const sameMonth = isSameMonth;
