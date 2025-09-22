export function makeConversationKey(requestId: string, a: string, b: string) {
  const [u1, u2] = [a, b].sort();
  return `${requestId}:${u1}:${u2}`;
}

export function encodeConversationId(key: string) {
  return Buffer.from(key).toString("base64url");
}

export function decodeConversationId(id: string) {
  try {
    const raw = Buffer.from(id, "base64url").toString("utf8");
    const [requestId, u1, u2] = raw.split(":");
    if (!requestId || !u1 || !u2) return null;
    return { requestId, u1, u2 } as const;
  } catch {
    return null;
  }
}

