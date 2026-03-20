export function normalizePersonName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function isValidPersonName(value: string): boolean {
  return value.length >= 2 && value.length <= 120;
}

export function resolveUserMetadataName(
  metadata: Record<string, unknown>,
): string {
  const candidates = [metadata.full_name, metadata.display_name, metadata.name];

  for (const candidate of candidates) {
    const normalized = normalizePersonName(candidate);
    if (normalized) return normalized;
  }

  return "";
}
