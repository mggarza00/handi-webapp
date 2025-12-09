export function formatMXN(amount: number): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `MXN ${Math.round(amount)}`;
  }
}

// Alias solicitado: acepta number | null | undefined y retorna '' si no hay valor
export const formatCurrencyMXN = (n?: number | null): string =>
  typeof n === 'number' ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : '';

export function formatDateMX(dateISO: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Mexico_City' }).format(new Date(dateISO));
  } catch {
    return new Date(dateISO).toLocaleDateString('es-MX');
  }
}

export default formatCurrencyMXN;
