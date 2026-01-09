export type SupportPriority = "baja" | "media" | "alta" | "critica";

const SLA_WINDOWS: Record<SupportPriority, number> = {
  critica: 2 * 60 * 60 * 1000, // 2h
  alta: 6 * 60 * 60 * 1000, // 6h
  media: 24 * 60 * 60 * 1000, // 24h
  baja: 48 * 60 * 60 * 1000, // 48h
};

const RISK_WINDOWS: Record<SupportPriority, number> = {
  critica: 30 * 60 * 1000, // 30m
  alta: 30 * 60 * 1000,
  media: 2 * 60 * 60 * 1000, // 2h
  baja: 2 * 60 * 60 * 1000,
};

export function computeSlaDueAt(
  priority: SupportPriority,
  now = new Date(),
): Date {
  const win = SLA_WINDOWS[priority] ?? SLA_WINDOWS.media;
  return new Date(now.getTime() + win);
}

export function isSlaAtRisk(
  priority: SupportPriority,
  slaDueAt?: string | Date | null,
  now = new Date(),
): boolean {
  if (!slaDueAt) return false;
  const due = new Date(slaDueAt);
  if (Number.isNaN(due.getTime())) return false;
  const window = RISK_WINDOWS[priority] ?? RISK_WINDOWS.media;
  return due.getTime() <= now.getTime() + window;
}
