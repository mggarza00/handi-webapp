/**
 * Normaliza y muestra la presencia a partir de un timestamp.
 * - Soporta ms/segundos o ISO.
 * - Si viene en el futuro (+2 min), se descarta para evitar valores erróneos.
 * - Evita NaN devolviendo "Sin actividad reciente".
 */
export function formatPresence(
  lastActiveAt: string | null | undefined,
): string {
  if (!lastActiveAt) return "Sin actividad reciente";

  const toMillis = (value: string): number | null => {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      // Si viene en segundos (10 dígitos), escalar a ms; si ya está en ms, conservar.
      return asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parsed = toMillis(lastActiveAt);
  if (parsed === null) return "Sin actividad reciente";

  const now = Date.now();
  // Si el timestamp está en el futuro por más de 2 minutos, lo ignoramos.
  if (parsed - now > 2 * 60 * 1000) return "Sin actividad reciente";

  const diff = Math.max(0, now - parsed);
  const mins = Math.floor(diff / 60000);
  if (mins < 3) return "En línea";
  if (mins < 60) return `Activo hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Activo hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Activo hace ${days}d`;
}

export default formatPresence;
