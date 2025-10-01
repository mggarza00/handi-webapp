import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StarRating from "@/components/StarRating";
import type { ClientData } from "@/lib/clients/get-client-data";

type Props = {
  data: ClientData;
};

export default function ClientProfileView({ data }: Props) {
  const { profile, ratingSummary, recentReviews, requests } = data;
  if (!profile) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Perfil del cliente</h1>
        <p className="mt-2 text-sm text-red-600">No se encontró el cliente solicitado.</p>
      </main>
    );
  }

  const ratingCount = ratingSummary.count;
  const ratingAverage = typeof ratingSummary.average === "number" ? ratingSummary.average : null;

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/" className="hover:underline">Inicio</Link> / {" "}
        <span className="text-slate-900 font-medium">Cliente</span>
      </nav>

      {/* Card superior: información general */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Image
            src={profile.avatar_url || "/images/Favicon-v1-jpeg.jpg"}
            alt={profile.full_name || "Cliente"}
            width={72}
            height={72}
            className="rounded-full border"
          />
          <div>
            <CardTitle className="text-2xl">{profile.full_name ?? "Cliente"}</CardTitle>
            <p className="text-sm text-slate-600">Miembro desde {profile.created_at?.slice(0, 10) ?? "—"}</p>
          </div>
        </CardHeader>
      </Card>

      {/* Card con calificación promedio y total de reseñas */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <StarRating value={ratingAverage} />
            <span className="text-sm text-slate-700">
              {ratingCount > 0 ? `${(ratingAverage ?? 0).toFixed(1)} · ${ratingCount} reseña${ratingCount !== 1 ? "s" : ""}` : "Sin reseñas aún"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sección de trabajos solicitados */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Trabajos solicitados</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-600">Este cliente aún no tiene trabajos.</p>
        ) : (
          <ul className="space-y-4">
            {requests.map((req) => (
              <li key={req.id} className="rounded border bg-white">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium">{req.title}</h3>
                    <span className="text-xs rounded-full border px-2 py-0.5 text-slate-700">{req.status ?? "—"}</span>
                  </div>
                  {req.description ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{req.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Creado el {req.created_at ? new Date(req.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
                <div className="border-t bg-slate-50 p-4">
                  <h4 className="text-sm font-medium text-slate-800">Reseña del profesional</h4>
                  {req.proReview ? (
                    <div className="mt-1 space-y-1">
                      <StarRating value={req.proReview.rating} />
                      {req.proReview.comment ? (
                        <p className="text-sm text-slate-700 whitespace-pre-line">{req.proReview.comment}</p>
                      ) : (
                        <p className="text-sm text-slate-600">Sin comentario.</p>
                      )}
                      {req.proReview.created_at ? (
                        <p className="text-xs text-slate-500">
                          {new Date(req.proReview.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-600">Aún no hay reseña del profesional.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sección de últimas reseñas del cliente */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reseñas recientes</h2>
        {recentReviews.length === 0 ? (
          <p className="text-sm text-slate-600">Aún no hay reseñas.</p>
        ) : (
          <ul className="space-y-3">
            {recentReviews.map((r) => (
              <li key={r.id} className="border-b pb-3 last:border-b-0">
                <div className="flex items-center gap-2 text-sm">
                  <StarRating value={r.rating} />
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
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{r.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

