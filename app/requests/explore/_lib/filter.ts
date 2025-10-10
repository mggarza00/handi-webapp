export type ExploreRow = {
  id: string;
  status?: string | null;
  is_explorable?: boolean | null;
  visible_in_explore?: boolean | null;
  [k: string]: unknown;
};

/**
 * Devuelve solo solicitudes visibles en Explore.
 * Regla:
 * - status debe ser 'active'
 * - y no deben estar marcadas explícitamente como no explorables.
 */
export function filterExplorableRequests<T extends ExploreRow>(rows: T[]): T[] {
  const blocked = new Set(["scheduled", "in_process", "finished", "completed", "canceled", "cancelled"]);
  return rows.filter((r) => {
    const st = (r.status || "").toString().toLowerCase();
    if (!st || st !== "active") return false;
    const isExpl = (r.is_explorable as unknown) as boolean | null | undefined;
    const visible = (r.visible_in_explore as unknown) as boolean | null | undefined;
    if (isExpl === false) return false;
    if (visible === false) return false;
    if (blocked.has(st)) return false;
    return true;
  });
}

