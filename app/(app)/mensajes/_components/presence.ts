export function formatPresence(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) return "Sin actividad reciente";
  const d = new Date(lastActiveAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 3) return "En línea";
  if (mins < 60) return `Activo hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Activo hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Activo hace ${days}d`;
}

export default formatPresence;

