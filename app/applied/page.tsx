import { cookies } from "next/headers";
import Link from "next/link";
import createClient from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";
import Breadcrumbs from "@/components/breadcrumbs";
import PageContainer from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AppRow = Database["public"]["Tables"]["applications"]["Row"];
type ReqRow = Database["public"]["Tables"]["requests"]["Row"];

export const dynamic = "force-dynamic";

type Search = { status?: string };

export default async function AppliedPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <PageContainer>
        <div>
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Mis postulaciones" },
            ]}
          />
          <h1 className="text-2xl font-semibold mt-4">Vacantes postuladas</h1>
          <p className="mt-4 text-sm text-slate-700">
            Debes iniciar sesión para ver tus postulaciones.
          </p>
        </div>
      </PageContainer>
    );
  }

  const allowed = new Set([
    "applied",
    "accepted",
    "rejected",
    "completed",
  ] as const);
  const statusParam = (searchParams?.status || "").toLowerCase();
  const selectedStatus = (
    allowed.has(statusParam as never) ? statusParam : undefined
  ) as "applied" | "accepted" | "rejected" | "completed" | undefined;

  let query = supabase
    .from("applications")
    .select("id, request_id, status, note, created_at")
    .eq("professional_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (selectedStatus) query = query.eq("status", selectedStatus);

  const { data: apps, error } = await query;

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Vacantes postuladas</h1>
        <p className="mt-4 text-sm text-red-600">{error.message}</p>
      </main>
    );
  }

  const list = (apps ?? []) as Pick<
    AppRow,
    "id" | "request_id" | "status" | "note" | "created_at"
  >[];
  const reqIds = Array.from(
    new Set(list.map((a) => a.request_id).filter(Boolean)),
  );
  let reqMap = new Map<
    string,
    Pick<ReqRow, "id" | "title" | "city" | "status">
  >();
  if (reqIds.length) {
    const supaAny = supabase as any;
    const { data: reqs } = await supaAny
      .from("requests")
      .select("id, title, city, status")
      .in("id", reqIds);
    if (reqs)
      reqMap = new Map(
        reqs.map((r) => [
          r.id,
          r as Pick<ReqRow, "id" | "title" | "city" | "status">,
        ]),
      );
  }

  const filters = [
    { label: "Todos", value: "" },
    { label: "Postulados", value: "applied" },
    { label: "Aceptados", value: "accepted" },
    { label: "Rechazados", value: "rejected" },
    { label: "Completados", value: "completed" },
  ];

  return (
    <PageContainer>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Mis postulaciones" },
          ]}
        />
        <header>
          <h1 className="text-2xl font-semibold">Vacantes postuladas</h1>
          <p className="text-sm text-slate-600">
            Tus postulaciones recientes y su estado.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.value === (selectedStatus ?? "");
            const href = f.value
              ? `/applied?status=${encodeURIComponent(f.value)}`
              : "/applied";
            return (
              <Link
                key={f.value || "all"}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-sm ${active ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {!list.length ? (
          <Card className="p-4 text-sm text-slate-600">
            Todavía no has postulado a ninguna solicitud.
          </Card>
        ) : (
          <ul className="divide-y rounded border">
            {list.map((a) => {
              const r = a.request_id ? reqMap.get(a.request_id) : undefined;
              return (
                <li key={a.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {a.status ?? "applied"}
                        </Badge>
                        <Link
                          href={`/requests/${a.request_id}`}
                          className="font-medium hover:underline"
                        >
                          {r?.title ?? a.request_id?.slice(0, 8) + "…"}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r?.city ? `${r.city} · ` : ""}
                        {new Date(a.created_at ?? "").toLocaleString()}
                      </p>
                      {a.note && (
                        <p className="text-sm mt-1 whitespace-pre-line">
                          {a.note}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <Link
                        href={`/requests/${a.request_id}`}
                        className="text-sm underline"
                      >
                        Ver solicitud
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
