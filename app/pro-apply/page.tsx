import { cookies } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import ProApplyForm from "./pro-apply-form.client";

import type { Database } from "@/types/supabase";
import PageContainer from "@/components/page-container";
import Breadcrumbs from "@/components/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function ProApplyPage() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "client" | "pro" | "admin" | null = null;
  let defaultFullName: string | null = null;
  let proStatus: "aceptado" | "en_proceso" | "rechazado" | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    role = (data?.role as typeof role) ?? null;
    defaultFullName = (data?.full_name as string | null) ?? null;
    try {
      // Attempt to read pro_status if column exists
      const ps = await supabase
        .from("profiles")
        .select("pro_status")
        .eq("id", user.id)
        .maybeSingle();
      const raw =
        (ps.data as null | { pro_status?: string | null })?.pro_status ?? null;
      if (raw === "aceptado" || raw === "en_proceso" || raw === "rechazado")
        proStatus = raw;
    } catch {
      proStatus = null;
    }
  }

  // Flag para header: en esta vista tratamos al usuario como "pro (no admitido)"
  // para ocultar enlaces de cliente como "Mis solicitudes".
  try {
    if (user && role !== "pro") {
      // Cookie limitada a esta ruta
      cookies().set("handi_pro_apply", "1", { path: "/pro-apply" });
    }
  } catch {
    // ignore
  }

  return (
    <PageContainer
      className="flex justify-center"
      contentClassName="w-full max-w-2xl"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Profesionales" },
            { label: "Postular" },
          ]}
        />
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Postula como profesional</h1>
          <p className="text-sm text-slate-600">
            Completa tu solicitud para validar tu perfil profesional. Revisamos
            identidad, referencias y experiencia.
          </p>
        </header>

        {!user && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-700">
              Necesitas iniciar sesión para continuar.
            </p>
            <div className="mt-3">
              <Link
                href={{
                  pathname: "/auth/sign-in",
                  query: { next: "/pro-apply" },
                }}
                className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        )}

        {user && role === "pro" && (
          <div className="space-y-3">
            {proStatus === "aceptado" && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                Tu perfil de profesional ha sido aceptado. Puedes gestionar
                trabajos disponibles.
              </div>
            )}
            {proStatus === "en_proceso" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Tu postulación está en proceso. Te notificaremos al ser
                aceptado.
              </div>
            )}
            {proStatus === "rechazado" && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                Tu postulación fue rechazada. Si crees que es un error,
                contáctanos o vuelve a postularte con nueva evidencia.
              </div>
            )}
          </div>
        )}

        {user && (
          <ProApplyForm
            userId={user.id}
            userEmail={user.email ?? ""}
            defaultFullName={defaultFullName ?? ""}
          />
        )}
      </div>
    </PageContainer>
  );
}
