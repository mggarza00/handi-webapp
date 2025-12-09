export const CITIES = [
  "Monterrey",
  "Guadalupe",
  "San Nicolás",
  "Apodaca",
  "Escobedo",
  "Santa Catarina",
  "García",
  "San Pedro Garza García",
] as const;

export type City = (typeof CITIES)[number];

// Normaliza un string removiendo acentos y en minúsculas
function normalize(s: string) {
  // Usar rango de combining marks para compatibilidad amplia (evita \p{...})
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]+/g, "")
    .toLowerCase()
    .trim();
}

// Mapa de sinónimos → ciudad canónica (normalizados)
const aliasToCanonical: Record<string, City> = {
  // Monterrey metro
  [normalize("Monterrey")]: "Monterrey",
  [normalize("Guadalupe")]: "Guadalupe",
  [normalize("San Nicolás")]: "San Nicolás",
  [normalize("San Nicolas")]: "San Nicolás",
  [normalize("San Nicolás de los Garza")]: "San Nicolás",
  [normalize("San Nicolas de los Garza")]: "San Nicolás",
  [normalize("Apodaca")]: "Apodaca",
  [normalize("Escobedo")]: "Escobedo",
  [normalize("General Escobedo")]: "Escobedo",
  [normalize("Gral. Escobedo")]: "Escobedo",
  [normalize("Santa Catarina")]: "Santa Catarina",
  [normalize("Garcia")]: "García",
  [normalize("García")]: "García",
  [normalize("San Pedro Garza Garcia")]: "San Pedro Garza García",
  [normalize("San Pedro Garza García")]: "San Pedro Garza García",
};

// Intenta mapear un nombre detectado a las ciudades soportadas
export function canonicalizeCityName(raw?: string | null): City | null {
  if (!raw) return null;
  const n = normalize(String(raw));
  if (!n) return null;
  // 1) Búsqueda directa por alias
  const direct = aliasToCanonical[n];
  if (direct) return direct;
  // 2) Si el string incluye un alias conocido (p.ej. "san nicolas de los garza" contiene "san nicolas")
  for (const [alias, city] of Object.entries(aliasToCanonical)) {
    if (n.includes(alias)) return city;
  }
  // 3) Coincidencia exacta contra el listado canónico
  for (const c of CITIES) {
    if (normalize(c) === n) return c;
  }
  return null;
}

// Centros aproximados de cada municipio soportado (lat, lng)
const CITY_CENTERS: Record<City, { lat: number; lng: number }> = {
  Monterrey: { lat: 25.6866, lng: -100.3161 },
  Guadalupe: { lat: 25.6768, lng: -100.2565 },
  "San Nicolás": { lat: 25.7417, lng: -100.3020 },
  Apodaca: { lat: 25.7803, lng: -100.1886 },
  Escobedo: { lat: 25.7947, lng: -100.3220 },
  "Santa Catarina": { lat: 25.6733, lng: -100.4581 },
  García: { lat: 25.8132, lng: -100.5948 },
  "San Pedro Garza García": { lat: 25.6597, lng: -100.4026 },
};

function toRad(deg: number) { return (deg * Math.PI) / 180; }

// Distancia Haversine en km
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Fallback offline: infiere ciudad por cercanía al centro del municipio
export function guessCityFromCoords(lat?: number | null, lng?: number | null, maxKm = 40): City | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const p = { lat, lng };
  let best: { city: City; km: number } | null = null;
  for (const city of CITIES) {
    const km = haversineKm(p, CITY_CENTERS[city]);
    if (!best || km < best.km) best = { city, km };
  }
  if (best && best.km <= maxKm) return best.city;
  return null;
}
