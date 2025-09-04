export type SendMessageBody = {
  request_id: string;
  to_user_id: string;
  text: string;
};

export async function sendMessage(body: SendMessageBody) {
  const res = await fetch(`/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/messages -> ${res.status} ${res.statusText}\n${text}`);
  }
  return (await res.json()) as { ok: true; data: { id: string; created_at: string } };
}

export type GetMessagesParams = { limit?: number; before?: string };

export async function getMessages(request_id: string, params: GetMessagesParams = {}) {
  const qs = new URLSearchParams();
  qs.set("request_id", request_id);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.before) qs.set("before", params.before);
  const url = `/api/messages?${qs.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return (await res.json()) as { ok: true; data: Array<{ id: string; sender_id: string; recipient_id: string; text: string; created_at: string }> };
}
