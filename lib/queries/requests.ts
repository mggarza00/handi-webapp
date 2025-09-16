export async function getProspectsForRequest(requestId: string) {
  const url = `/api/requests/${requestId}/prospects`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return (await res.json()) as { ok: true; data: unknown[] };
}

