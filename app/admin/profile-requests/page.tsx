import { redirect } from "next/navigation";
import createClient from "@/utils/supabase/server";

export default async function AdminProfileRequestsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const allowEmail = process.env.SEED_ADMIN_EMAIL as string | undefined;
  type Profile = { role?: string | null; is_admin?: boolean | null };
  const isAdmin =
    (profile as Profile | null)?.is_admin === true ||
    (profile as Profile | null)?.role === "admin" ||
    (allowEmail && user.email?.toLowerCase() === allowEmail.toLowerCase());
  if (!isAdmin) redirect("/");

  const { data: requests } = await supabase
    .from("profile_change_requests")
    .select("id, user_id, status, payload, created_at, review_notes, reviewed_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  type ChangePayload = { profiles?: Record<string, unknown>; professionals?: Record<string, unknown> } | null;
  const list = (requests || []) as Array<{
    id: string;
    user_id: string;
    status: string;
    payload: ChangePayload;
    created_at: string | null;
  }>;

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Solicitudes de cambio de perfil</h1>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="space-y-4">
          {list.map((r) => {
            const prof = Object.keys((r.payload?.profiles as Record<string, unknown> | undefined) || {});
            const pro = Object.keys((r.payload?.professionals as Record<string, unknown> | undefined) || {});
            const summary = [...prof.map((k) => `profiles.${k}`), ...pro.map((k) => `professionals.${k}`)];
            return (
              <li key={r.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{r.user_id}</div>
                    <div className="text-muted-foreground">{new Date(r.created_at || Date.now()).toLocaleString()}</div>
                    <div className="mt-1 text-muted-foreground">Campos: {summary.join(", ") || "(sin resumen)"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={`/api/profile-change-requests/${r.id}/approve`} method="post">
                      <button className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm" type="submit">Aprobar</button>
                    </form>
                    <form action={`/api/profile-change-requests/${r.id}/reject`} method="post" className="flex items-center gap-2">
                      <input type="text" name="review_notes" placeholder="Motivo (opcional)" className="h-9 px-2 rounded border text-sm" />
                      <button className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm" type="submit">Rechazar</button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
