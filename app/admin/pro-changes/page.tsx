import Link from "next/link";

import { ProChangeActionsCell } from "@/components/admin/ProChangeActionsCell.client";
import type { Database } from "@/types/supabase";
import createClient from "@/utils/supabase/server";

type ProfileChangePayload = {
  profiles?: Record<string, unknown> | null;
  professionals?: Record<string, unknown> | null;
  gallery_add_paths?: string[] | null;
};

type ProfileChangeRow = Pick<
  Database["public"]["Tables"]["profile_change_requests"]["Row"],
  "id" | "user_id" | "status" | "payload" | "created_at"
>;

export const dynamic = "force-dynamic";

export default async function AdminProChangesPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("profile_change_requests")
    .select("id, user_id, status, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (rows || []) as ProfileChangeRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cambios de perfil solicitados</h1>
        <Link href="/admin/pro-applications" className="text-sm text-slate-600 hover:text-slate-900">
          Ver postulaciones
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Campos</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Creada</th>
              <th className="px-3 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No hay solicitudes.
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const payload = (r.payload as unknown as ProfileChangePayload | null) ?? null;
                const prof = Object.keys((payload?.profiles as Record<string, unknown> | undefined) || {});
                const pro = Object.keys((payload?.professionals as Record<string, unknown> | undefined) || {});
                const galleryAdds = Array.isArray(payload?.gallery_add_paths)
                  ? payload.gallery_add_paths.length
                  : 0;
                const summary = [
                  ...prof.map((k) => `profiles.${k}`),
                  ...pro.map((k) => `professionals.${k}`),
                  ...(galleryAdds > 0 ? [`gallery(+${galleryAdds})`] : []),
                ];
                return (
                  <tr key={r.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{r.user_id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[520px] truncate" title={summary.join(", ") || "(sin resumen)"}>
                        {summary.join(", ") || "(sin resumen)"}
                      </div>
                    </td>
                    <td className="px-3 py-2">{labelStatus(r.status)}</td>
                    <td className="px-3 py-2">{new Date(r.created_at || "").toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <ProChangeActionsCell id={r.id} status={r.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function labelStatus(s: string | null) {
  switch (s) {
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    default:
      return "En revisión";
  }
}
