import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

type Params = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({ params }: Params) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, created_at")
    .eq("id", params.id)
    .maybeSingle<{
      full_name: string | null;
      avatar_url: string | null;
      created_at: string | null;
    }>();

  if (error || !profile) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Perfil del cliente</h1>
        <p className="text-sm text-red-600 mt-2">No se encontró el cliente.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <nav className="text-sm text-slate-600">
        <Link href="/" className="hover:underline">Inicio</Link> / {" "}
        <span className="text-slate-900 font-medium">Cliente</span>
      </nav>

      <section className="flex items-center gap-4">
        <Image
          src={profile.avatar_url || "/images/Favicon-v1-jpeg.jpg"}
          alt={profile.full_name || "Cliente"}
          width={72}
          height={72}
          className="rounded-full border"
        />
        <div>
          <h1 className="text-2xl font-semibold">{profile.full_name ?? "Cliente"}</h1>
          <p className="text-sm text-slate-600">Miembro desde {profile.created_at?.slice(0, 10) ?? "—"}</p>
          <p className="text-sm text-slate-600">Calificación: —</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Reseñas</h2>
        <p className="text-sm text-slate-600">Próximamente: reseñas de trabajos anteriores.</p>
      </section>
    </main>
  );
}

