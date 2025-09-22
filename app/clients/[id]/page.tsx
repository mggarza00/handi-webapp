import { cookies, headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

type Params = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: Params) {
  function getBaseUrl() {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "http";
    return (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (host ? `${proto}://${host}` : "http://localhost:3000")
    );
  }

  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, created_at")
    .eq("id", params.id)
    .maybeSingle<{
      full_name: string | null;
      avatar_url: string | null;
      created_at: string | null;
    }>();

  if (error || !profile) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Perfil del cliente</h1>
        <p className="text-sm text-red-600 mt-2">No se encontró el cliente.</p>
      </main>
    );
  }

  const base = getBaseUrl();
  const [rRes, rAggRes] = await Promise.all([
    fetch(`${base}/api/reviews?client_id=${params.id}&limit=5`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      cache: "no-store",
    }),
    fetch(`${base}/api/reviews?client_id=${params.id}&aggregate=1`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      cache: "no-store",
    }),
  ]);
  const rJson = await rRes.json().catch(() => null);
  const rAggJson = await rAggRes.json().catch(() => null);
  const reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string | null;
  }> = rRes.ok && rJson?.data ? rJson.data : [];
  const ratingCount: number = rAggRes.ok && rAggJson?.summary?.count ? Number(rAggJson.summary.count) : 0;
  const ratingAverage: number | null = rAggRes.ok && typeof rAggJson?.summary?.average === "number" ? (rAggJson.summary.average as number) : null;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/" className="hover:underline">Inicio</Link> / {" "}
        <span className="text-slate-900 font-medium">Cliente</span>
      </nav>

      <section className="flex items-center gap-4">
        <Image
          src={profile.avatar_url || "/images/Favicon-v1-jpeg.jpg"}
          alt={profile.full_name || "Cliente"}
          width={72}
          height={72}
          className="rounded-full border"
        />
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name ?? "Cliente"}</h1>
          <p className="text-sm text-slate-600">Miembro desde {profile.created_at?.slice(0, 10) ?? "—"}</p>
          <p className="text-sm text-slate-600">
            Calificación: {ratingAverage != null ? ratingAverage.toFixed(1) : "—"}
            {ratingCount > 0 ? ` (${ratingCount} reseña${ratingCount !== 1 ? "s" : ""})` : ""}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reseñas</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-600">Aún no hay reseñas.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="border-b pb-3 last:border-b-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-amber-500" aria-label={`Calificación ${r.rating} de 5`}>
                    {Array.from({ length: 5 }, (_, i) => (i < Math.round(r.rating) ? "★" : "☆")).join("")}
                  </span>
                  {r.created_at ? (
                    <span className="text-slate-500">
                      {new Date(r.created_at).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  ) : null}
                </div>
                {r.comment ? (
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">
                    {r.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
