export function formatCurrencyMXN(value: number): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `MXN ${value.toFixed(2)}`;
  }
}

export function formatDateTimeCDMX(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    }).format(d);
  } catch {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return d.toLocaleString('es-MX');
  }
}

export function formatDateCDMX(iso: string | Date): string {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long',
      timeZone: 'America/Mexico_City',
    }).format(d);
  } catch {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return d.toLocaleDateString('es-MX');
  }
}

