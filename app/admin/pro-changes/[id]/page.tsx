import Link from "next/link";
import { notFound } from "next/navigation";

import { AvatarThumb } from "@/components/admin/AvatarThumb";
import { Card } from "@/components/ui/card";
import { normalizeAvatarUrl } from "@/lib/avatar";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type ProfileChangePayload = {
  profiles?: Record<string, unknown> | null;
  professionals?: Record<string, unknown> | null;
  avatar_draft_path?: string | null;
  avatar_preview_url?: string | null;
  gallery_add_paths?: string[] | null;
};

type ProfileChangeRow = Pick<
  Database["public"]["Tables"]["profile_change_requests"]["Row"],
  "id" | "user_id" | "status" | "payload" | "created_at"
>;

type Ctx = { params: { id: string } };

function toHuman(v: unknown): string {
  try {
    if (v == null) return "";
    if (Array.isArray(v)) {
      const parts = v
        .map((x) => {
          if (typeof x === "string") return x.trim();
          if (x && typeof x === "object") {
            const anyX = x as Record<string, unknown>;
            const name = anyX?.name;
            if (typeof name === "string") return name.trim();
            try {
              return JSON.stringify(x);
            } catch {
              return String(x);
            }
          }
          return String(x ?? "");
        })
        .filter(Boolean);
      return parts.join(", ");
    }
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      const anyV = v as Record<string, unknown>;
      if (typeof anyV?.name === "string") return anyV.name;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  } catch {
    return String(v ?? "");
  }
}

function same(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function normalizeForDisplay(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) && raw.includes("/storage/v1/object/sign/")) {
    return raw;
  }
  return normalizeAvatarUrl(raw) || raw;
}

export const dynamic = "force-dynamic";

export default async function ProChangesDetailPage({ params }: Ctx) {
  const id = params.id;
  const admin = getAdminSupabase();
  const { data: req } = await admin
    .from("profile_change_requests")
    .select("id, user_id, status, payload, created_at")
    .eq("id", id)
    .maybeSingle<ProfileChangeRow>();
  if (!req) return notFound();

  const userId = String(req.user_id);
  const payload = (req.payload as ProfileChangePayload | null) ?? null;
  const profPatch =
    (payload?.profiles as Record<string, unknown> | undefined) ?? {};
  const proPatch =
    (payload?.professionals as Record<string, unknown> | undefined) ?? {};
  const galleryAdd = Array.isArray(payload?.gallery_add_paths)
    ? payload.gallery_add_paths
    : [];

  let profCur: Record<string, unknown> = {};
  let proCur: Record<string, unknown> = {};
  try {
    const pr = await admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (pr?.data) profCur = pr.data as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  try {
    const pr2 = await admin
      .from("professionals")
      .select(
        "headline, years_experience, city, cities, categories, subcategories, avatar_url, bio",
      )
      .eq("id", userId)
      .maybeSingle();
    if (pr2?.data) proCur = pr2.data as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  let publishedGallery: string[] = [];
  try {
    const prefix = `${userId}/`;
    const list = await admin.storage
      .from("professionals-gallery")
      .list(prefix, {
        limit: 100,
        sortBy: { column: "updated_at", order: "desc" },
      });
    if (!list.error && Array.isArray(list.data)) {
      publishedGallery = await Promise.all(
        list.data
          .filter(
            (file) => typeof file?.name === "string" && file.name.length > 0,
          )
          .map(async (obj) => {
            const path = `${prefix}${String(obj.name)}`;
            const signed = await admin.storage
              .from("professionals-gallery")
              .createSignedUrl(path, 3600)
              .catch(() => ({ data: null }));
            return signed.data?.signedUrl || "";
          }),
      );
      publishedGallery = publishedGallery.filter(Boolean);
    }
  } catch {
    /* ignore */
  }

  let draftGallery: string[] = [];
  try {
    draftGallery = await Promise.all(
      galleryAdd.map(async (path) => {
        const signed = await admin.storage
          .from("profiles-gallery")
          .createSignedUrl(path, 3600);
        return signed?.data?.signedUrl || "";
      }),
    );
    draftGallery = draftGallery.filter(Boolean);
  } catch {
    /* ignore */
  }

  const currentAvatarRaw =
    (typeof profCur.avatar_url === "string" && profCur.avatar_url) ||
    (typeof proCur.avatar_url === "string" && proCur.avatar_url) ||
    "";
  const currentAvatar = normalizeForDisplay(currentAvatarRaw) || null;

  let proposedAvatar: string | null = null;
  const draftAvatarPath =
    typeof payload?.avatar_draft_path === "string" &&
    payload.avatar_draft_path.startsWith(`${userId}/`)
      ? payload.avatar_draft_path
      : null;
  if (draftAvatarPath) {
    try {
      const signed = await admin.storage
        .from("profile-change-avatars")
        .createSignedUrl(draftAvatarPath, 3600);
      proposedAvatar = signed.data?.signedUrl || null;
    } catch {
      proposedAvatar = null;
    }
  }
  if (!proposedAvatar) {
    // Legacy compat for existing requests with avatar_url in patch payload.
    const legacyProposed =
      (typeof profPatch.avatar_url === "string" && profPatch.avatar_url) ||
      (typeof proPatch.avatar_url === "string" && proPatch.avatar_url) ||
      (typeof payload?.avatar_preview_url === "string" &&
        payload.avatar_preview_url) ||
      "";
    proposedAvatar = normalizeForDisplay(legacyProposed) || null;
  }

  const rows: Array<{
    label: string;
    cur: unknown;
    next: unknown;
    isImage?: boolean;
  }> = [
    { label: "Nombre", cur: profCur.full_name, next: profPatch.full_name },
    {
      label: "Avatar",
      cur: currentAvatar,
      next: proposedAvatar,
      isImage: true,
    },
    { label: "Titular", cur: proCur.headline, next: proPatch.headline },
    { label: "Bio", cur: proCur.bio, next: proPatch.bio },
    {
      label: "Años experiencia",
      cur: proCur.years_experience,
      next: proPatch.years_experience,
    },
    { label: "Ciudad", cur: proCur.city, next: proPatch.city },
    { label: "Ciudades", cur: proCur.cities, next: proPatch.cities },
    { label: "Categorías", cur: proCur.categories, next: proPatch.categories },
    {
      label: "Subcategorías",
      cur: proCur.subcategories,
      next: proPatch.subcategories,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cambios solicitados</h1>
        <Link
          href="/admin/pro-changes"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Volver
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <form
          action={`/api/profile-change-requests/${id}/approve`}
          method="post"
        >
          <button
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white"
            type="submit"
          >
            Aprobar
          </button>
        </form>
        <form
          action={`/api/profile-change-requests/${id}/reject`}
          method="post"
          className="flex items-center gap-2"
        >
          <input
            type="text"
            name="review_notes"
            placeholder="Motivo (opcional)"
            className="h-8 w-56 rounded border px-2 text-xs"
          />
          <button
            className="rounded bg-red-600 px-3 py-1.5 text-xs text-white"
            type="submit"
          >
            Rechazar
          </button>
        </form>
      </div>
      <Card className="overflow-x-auto p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Actual</th>
              <th className="px-3 py-2">Propuesto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = !same(r.cur ?? null, r.next ?? null);
              const cls = diff ? "bg-yellow-50" : "";
              return (
                <tr
                  key={r.label}
                  className="align-top border-t border-slate-200"
                >
                  <td className="whitespace-nowrap px-3 py-2">{r.label}</td>
                  <td className={`px-3 py-2 ${cls}`}>
                    {r.isImage ? (
                      <AvatarThumb
                        src={typeof r.cur === "string" ? r.cur : null}
                        alt="avatar actual"
                      />
                    ) : (
                      <span>{toHuman(r.cur)}</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 ${cls}`}>
                    {r.isImage ? (
                      <AvatarThumb
                        src={typeof r.next === "string" ? r.next : null}
                        alt="avatar propuesto"
                      />
                    ) : (
                      <span>{toHuman(r.next)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Galería publicada (actual)</h2>
          {publishedGallery.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {publishedGallery.map((u) => (
                <li key={u}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt="foto actual"
                    className="h-28 w-full rounded border object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Sin fotos publicadas.</p>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-medium">Galería propuesta</h2>
          {draftGallery.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {draftGallery.map((u, i) => (
                <li key={`${u}-${i}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt="foto propuesta"
                    className="h-28 w-full rounded border bg-yellow-50 object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              Sin nuevas fotos en la solicitud.
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
