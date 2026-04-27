type ResolveClientProfileIdArgs = {
  clientProfileId?: string | null;
  requestClientId?: string | null;
  createdBy?: string | null;
};

export function normalizeClientProfileId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveRequestClientProfileId({
  clientProfileId,
  requestClientId,
  createdBy,
}: ResolveClientProfileIdArgs): string | null {
  return (
    normalizeClientProfileId(clientProfileId) ??
    normalizeClientProfileId(requestClientId) ??
    normalizeClientProfileId(createdBy)
  );
}

export function buildClientProfilePath(
  args: ResolveClientProfileIdArgs,
): string | null {
  const clientProfileId = resolveRequestClientProfileId(args);
  return clientProfileId ? `/clients/${clientProfileId}` : null;
}
