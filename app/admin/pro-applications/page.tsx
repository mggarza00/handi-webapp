import Link from "next/link";

import { getAdminSupabase } from "../../../lib/supabase/admin";

import AdminActions from "./AdminActions.client";

import type { Database } from "@/types/supabase";
import createClient from "@/utils/supabase/server";

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "role" | "is_admin">;

type Search = {
  searchParams: {
    page?: string;
    q?: string;
    status?: string;
    from?: string;
    to?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function AdminProApplicationsPage({
  searchParams,
}: Search) {
  const supa = createClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return unauth();
  const { data: prof } = await supa
    .from("profiles")
    .select("role, is_admin")
    .eq("id", auth.user.id)
    .maybeSingle<ProfileRow>();
  const allowEmail = process.env.SEED_ADMIN_EMAIL as string | undefined;
  const isAdmin =
    prof?.is_admin === true ||
    prof?.role === "admin" ||
    (allowEmail && auth.user.email?.toLowerCase() === allowEmail.toLowerCase());
  if (!isAdmin) return forbidden();

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = (searchParams.status ?? "").toString();
  const q = (searchParams.q ?? "").toString().trim();
  const fromDate = (searchParams.from ?? "").toString();
  const toDate = (searchParams.to ?? "").toString();

  const admin = getAdminSupabase();
  let builder = admin
    .from("pro_applications")
    .select("id, user_id, full_name, email, phone, empresa, status, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status && ["pending", "accepted", "rejected"].includes(status)) {
    builder = builder.eq("status", status as "pending");
  }
  if (fromDate)
    builder = builder.gte("created_at", new Date(fromDate).toISOString());
  if (toDate)
    builder = builder.lte(
      "created_at",
      new Date(
        new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1,
      ).toISOString(),
    );
  if (q) {
    const term = `%${q.replace(/%/g, "").replace(/\s+/g, "%")}%`;
    builder = builder.or(
      `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},user_id.ilike.${term}`,
    );
  }
  const { data: rows, count, error } = await builder;
  if (error) return problem(error.message);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Postulaciones de Profesionales</h1>
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          Volver al inicio
        </Link>
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, correo, teléfono o user id"
          className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todas</option>
          <option value="pending">En revisión</option>
          <option value="accepted">Aceptadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={fromDate}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={toDate}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Correo</th>
              <th className="px-3 py-2">Teléfono</th>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Creada</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td className="px-3 py-2 font-mono text-xs">
                  {r.id.slice(0, 8)}
                </td>
                <td className="px-3 py-2">{r.full_name}</td>
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.phone}</td>
                <td className="px-3 py-2">{r.empresa ? "Sí" : "No"}</td>
                <td className="px-3 py-2">{labelStatus(r.status)}</td>
                <td className="px-3 py-2">
                  {new Date(r.created_at || "").toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <AdminActions id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <div>
          Página {page} de {pages} · {total} resultados
        </div>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={`?${qs({ q, status, from: fromDate, to: toDate, page: String(page - 1) })}`}
              className="rounded border border-slate-300 px-3 py-1"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {page < pages ? (
            <Link
              href={`?${qs({ q, status, from: fromDate, to: toDate, page: String(page + 1) })}`}
              className="rounded border border-slate-300 px-3 py-1"
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}

function labelStatus(s: string | null) {
  switch (s) {
    case "accepted":
  return "Aceptada";
    case "rejected":
      return "Rechazada";
    default:
      return "En revisión";
  }
}

function qs(obj: Record<string, string>) {
  const u = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v) u.set(k, v);
  });
  return u.toString();
}

function unauth() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">Debes iniciar sesión.</main>
  );
}
function forbidden() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">No tienes permisos.</main>
  );
}
function problem(msg: string) {
  return <main className="mx-auto max-w-3xl px-4 py-12">Error: {msg}</main>;
}
