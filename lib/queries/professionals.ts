export type ProfessionalsQuery = {
  city?: string | null;
  category?: string | null;
  page?: number;
};

export async function getProfessionals(params: ProfessionalsQuery = {}) {
  const qs = new URLSearchParams();
  if (params.city) qs.set("city", params.city);
  if (params.category) qs.set("category", params.category);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const url = `/api/professionals${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}\n${text}`);
  }
  return (await res.json()) as { ok: true; data: unknown[] };
}

export type ProfileUpsertBody = {
  full_name?: string;
  avatar_url?: string;
  headline?: string;
  bio?: string;
  years_experience?: number;
  city?: string;
  cities?: string[];
  categories?: Array<{ name: string } | string>;
  subcategories?: Array<{ name: string } | string>;
};

export async function upsertMyProfile(body: ProfileUpsertBody) {
  const res = await fetch(`/api/professionals`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `POST /api/professionals -> ${res.status} ${res.statusText}\n${text}`,
    );
  }
  return (await res.json()) as { ok: true; id: string };
}
