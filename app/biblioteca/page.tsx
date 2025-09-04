"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import PageContainer from "@/components/page-container";

export default function PagesLibrary() {
  const router = useRouter();
  const [requestId, setRequestId] = React.useState("");
  const [profileId, setProfileId] = React.useState("");

  const routes: Array<{ label: string; href: string; note?: string }> = [
    { label: "Inicio", href: "/" },
    { label: "Iniciar sesión", href: "/auth/sign-in" },
    { label: "Mi perfil (/me)", href: "/me" },
    { label: "Configura tu perfil", href: "/profile/setup" },
    { label: "Mis postulaciones (pro)", href: "/applied" },
    { label: "Panel profesional", href: "/dashboard/pro" },
    { label: "Solicitudes", href: "/requests" },
    { label: "Nueva solicitud", href: "/requests/new" },
    { label: "Buscar profesionales", href: "/search" },
    { label: "Centro de ayuda", href: "/help" },
  ];

  return (
    <PageContainer>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Biblioteca de páginas</h1>
          <p className="text-sm text-slate-600">Accesos directos para navegar en desarrollo.</p>
        </header>

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Rutas principales</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {routes.map((r) => (
            <li key={r.href}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={r.href}>{r.label}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h2 className="text-lg font-medium">Rutas dinámicas</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!requestId.trim()) return;
              router.push(`/requests/${requestId.trim()}`);
            }}
            className="flex w-full items-center gap-2"
          >
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="UUID de solicitud (requests/:id)"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            />
            <Button type="submit" variant="default">Abrir</Button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!profileId.trim()) return;
              router.push(`/profiles/${profileId.trim()}`);
            }}
            className="flex w-full items-center gap-2"
          >
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="UUID de perfil (profiles/:id)"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            />
            <Button type="submit" variant="default">Abrir</Button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 space-y-2">
        <h2 className="text-lg font-medium">Acciones</h2>
        <div className="flex flex-wrap gap-2">
          <form action="/auth/sign-out" method="post">
            <Button type="submit" variant="destructive">Cerrar sesión</Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/auth/sign-in">Ir a Iniciar sesión</Link>
          </Button>
        </div>
      </section>
      </div>
    </PageContainer>
  );
}
