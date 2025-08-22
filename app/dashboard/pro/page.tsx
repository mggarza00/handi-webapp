import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function ProDashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="p-6">Debes iniciar sesión para ver tu panel.</p>;
  }

  const { count: postCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", user.id);

  const { count: negotiatingCount } = await supabase
    .from("agreements")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", user.id)
    .eq("status", "negotiating");

  const { count: pendingPaymentCount } = await supabase
    .from("agreements")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", user.id)
    .eq("status", "paid");

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Panel profesional</h1>
        <p className="text-muted-foreground">
          Aquí verás tus postulaciones, acuerdos y notificaciones.
        </p>
      </header>

      <section className="rounded-2xl border p-6">
        <h2 className="text-lg font-medium mb-4">Estado general</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Postulaciones recientes: {postCount || 0}</li>
          <li>Acuerdos en negociación: {negotiatingCount || 0}</li>
          <li>Pagos pendientes de confirmar: {pendingPaymentCount || 0}</li>
        </ul>
      </section>
    </main>
  );
}
