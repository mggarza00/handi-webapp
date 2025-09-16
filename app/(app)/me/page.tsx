import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import ProfileEdit from "./profile-edit.client";

import type { Database } from "@/types/supabase";
import UpdateEmailForm from "@/components/UpdateEmailForm";
import { Button } from "@/components/ui/button";

export default async function MePage() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <p className="mt-4 text-red-600">
          Ocurrió un error al obtener tu sesión.
        </p>
        <pre className="mt-2 rounded bg-slate-100 p-3 text-xs text-slate-700 overflow-auto">
          {error.message}
        </pre>
      </main>
    );
  }

  const user = data?.user ?? null;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <p className="mt-4 text-slate-700">
          No has iniciado sesión. Por favor inicia sesión para ver tu
          información.
        </p>
      </main>
    );
  }

  // Cargar tipo de usuario (role) desde la tabla profiles
  let roleLabel: string | null = null;
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (prof?.role ?? null) as null | "client" | "pro" | "admin";
    roleLabel =
      role === "client"
        ? "Cliente"
        : role === "pro"
          ? "Profesional"
          : role === "admin"
            ? "Administrador"
            : null;
  } catch {
    roleLabel = null;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="destructive" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <section className="mt-6 space-y-3">
        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium">Cuenta</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">ID</dt>
              <dd className="text-sm font-mono">{user.id}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Email</dt>
              <dd className="text-sm">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Tipo de usuario</dt>
              <dd className="text-sm">{roleLabel ?? "Cliente"}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Provider</dt>
              <dd className="text-sm">
                {(user.app_metadata?.provider as string | undefined) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Creado</dt>
              <dd className="text-sm">
                {new Date(user.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <UpdateEmailForm currentEmail={user.email ?? null} />

        {/* Edición de perfil básico */}
        <ProfileEdit />

        <div className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-medium">Raw (debug)</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </section>
    </main>
  );
}
