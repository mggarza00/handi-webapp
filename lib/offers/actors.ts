export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | string;

export function extractOfferId(offer: unknown): string | null {
  if (!offer || typeof offer !== 'object') return null;
  const o = offer as Record<string, unknown>;
  const p = (o.payload as Record<string, unknown> | undefined) || undefined;
  const id = (o.id ?? o.offer_id ?? p?.offer_id ?? p?.id) as unknown;
  return typeof id === 'string' && id.trim().length ? id : null;
}

export function resolveOfferStatus(offer: unknown): OfferStatus {
  const o = (offer && typeof offer === 'object') ? (offer as Record<string, unknown>) : undefined;
  const raw = (
    (typeof offer === 'string' ? offer : undefined) ??
    (o?.status as unknown) ??
    (o?.offer_status as unknown) ??
    ((o?.payload as Record<string, unknown> | undefined)?.status as unknown) ??
    'pending'
  );
  const s = String(raw).trim().toLowerCase();
  if (s === 'sent') return 'pending';
  return s as OfferStatus;
}

export function extractProfessionalId(offer: unknown): string | null {
  if (!offer || typeof offer !== 'object') return null;
  const o = offer as Record<string, unknown>;
  const pid = o.professional_id ?? o.pro_id ?? (o.payload as Record<string, unknown> | undefined)?.professional_id ?? (o.payload as Record<string, unknown> | undefined)?.pro_id;
  return typeof pid === 'string' && pid.trim().length ? pid : null;
}

export function isOwnerPro(offer: unknown, viewer: unknown, sessionUser?: unknown): boolean {
  const proIds = new Set(extractProIds(offer));
  const viewerIds = extractViewerIds(viewer, sessionUser);
  return viewerIds.some((id) => proIds.has(id));
}

// Alias conveniencia: extrae y normaliza estado desde un objeto oferta o payload
export function extractStatus(offer: unknown): OfferStatus {
  return resolveOfferStatus(offer);
}

// Dev/diagnóstico: devuelve un resumen de IDs de pro encontrados en distintas claves
export function extractProIds(offer: unknown): string[] {
  if (!offer || typeof offer !== 'object') return [];
  const o = offer as Record<string, unknown>;
  const p = (o.payload as Record<string, unknown> | undefined) || undefined;
  const or = o as Record<string, unknown>;
  const pr = (p as Record<string, unknown> | undefined);
  const candidates: unknown[] = [
    or["professional_id"],
    or["professionalId"],
    or["pro_id"],
    or["proId"],
    or["profile_id"], // algunos modelos usan profile_id
    pr?.["professional_id"],
    pr?.["professionalId"],
    pr?.["pro_id"],
    pr?.["proId"],
    (or["professional"] as Record<string, unknown> | undefined)?.id,
    ((pr?.["professional"]) as Record<string, unknown> | undefined)?.id,
  ];
  const ids = candidates.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return Array.from(new Set(ids));
}

// Dev/diagnóstico: devuelve IDs de viewer detectados en diferentes estructuras
export function extractViewerIds(viewer: unknown, sessionUser?: unknown): string[] {
  const v = (viewer && typeof viewer === 'object') ? (viewer as Record<string, unknown>) : undefined;
  const s = (sessionUser && typeof sessionUser === 'object') ? (sessionUser as Record<string, unknown>) : undefined;
  const candidates: unknown[] = [
    v?.id,
    (v?.profile as Record<string, unknown> | undefined)?.id,
    v?.profile_id,
    s?.id,
  ];
  const ids = candidates.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return Array.from(new Set(ids));
}

// Regla principal: el profesional puede actuar si es dueño y la oferta está pending
export function canProAct(offer: unknown, viewer: unknown, sessionUser?: unknown): boolean {
  return isOwnerPro(offer, viewer, sessionUser) && extractStatus(offer) === 'pending';
}
