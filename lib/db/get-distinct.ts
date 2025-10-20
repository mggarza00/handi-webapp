"use server";

import { createClient } from "@/lib/supabase-server";

/**
 * Obtiene valores distintos (no nulos/ni vacíos) para una columna.
 * Nota: deduplica en memoria por simplicidad.
 */
export async function getDistinct(
  table: string,
  column: string,
  limit = 1000,
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .not(column, "is", null)
    .order(column, { ascending: true })
    .limit(Math.max(1, limit));
  if (error) return [];
  const set = new Set<string>();
  for (const row of ((data as unknown) as Array<Record<string, unknown>>) || []) {
    const v = row[column];
    if (typeof v === "string") {
      const s = v.trim();
      if (s && s.toLowerCase() !== "todas") set.add(s);
    }
  }
  return Array.from(set);
}

export default getDistinct;
