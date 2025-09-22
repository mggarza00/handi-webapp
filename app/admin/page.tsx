import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function AdminPage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookies().get(n)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_admin, full_name")
    .eq("id", user.id)
    .single();
  const allowEmail = process.env.SEED_ADMIN_EMAIL as string | undefined;
  type Profile = { role: string | null; is_admin: boolean | null; full_name?: string | null };
  const prof = (profile ?? null) as Profile | null;
  const isAdmin =
    prof?.is_admin === true ||
    prof?.role === "admin" ||
    (allowEmail && user.email?.toLowerCase() === allowEmail.toLowerCase());
  if (error || !profile || !isAdmin) redirect("/");

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Admin panel</h1>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-70">Resumen</div><div className="text-2xl font-semibold">—</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-70">Postulaciones (hoy)</div><div className="text-2xl font-semibold">—</div></div>
        <div className="rounded-2xl border p-4"><div className="text-sm opacity-70">Notificaciones</div><div className="text-2xl font-semibold">—</div></div>
      </section>

      <section className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Postulaciones de Profesionales</h2>
          <div className="flex gap-2">
            <a className="px-3 py-1 rounded-full border text-sm" href="/admin/pro-applications?status=pending">En Revisión</a>
            <a className="px-3 py-1 rounded-full border text-sm" href="/admin/pro-applications?status=accepted">Aceptadas</a>
            <a className="px-3 py-1 rounded-full border text-sm" href="/admin/pro-applications?status=rejected">Rechazadas</a>
          </div>
        </div>
        <div className="mt-3 text-sm opacity-70">Recientes</div>
        {/* Renderiza tu lista real aquí */}
      </section>
    </main>
  );
}
