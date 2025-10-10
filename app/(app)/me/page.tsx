import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { normalizeAvatarUrl } from "@/lib/avatar";

export default async function MePage() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, avatar_url, role, city, bio, categories, subcategories, is_client_pro",
    )
    .eq("id", user.id)
    .maybeSingle();

  const { data: pro } = await supabase
    .from("professionals")
    .select(
      "headline, years_experience, city, categories, subcategories, avatar_url, bio",
    )
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name ?? user.user_metadata?.full_name ?? "Usuario";
  const avatarUrl = normalizeAvatarUrl(
    profile?.avatar_url ??
      pro?.avatar_url ??
      (user.user_metadata?.avatar_url as string | null) ??
      null,
  );
  const role = (profile?.role ?? null) as null | "client" | "pro" | "admin";
  const roleLabel =
    role === "pro" ? "Profesional" : role === "admin" ? "Administrador" : "Cliente";

  const city = pro?.city ?? profile?.city ?? null;
  const skills =
    (pro?.categories as unknown as Array<{ name: string }> | null) ??
    ((profile?.categories as unknown as Array<{ name: string }>) ?? null);
  const subcats =
    (pro?.subcategories as unknown as Array<{ name: string }> | null) ??
    ((profile?.subcategories as unknown as Array<{ name: string }>) ?? null);
  const bio = pro?.bio ?? profile?.bio ?? null;
  const years = pro?.years_experience ?? null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl || "/avatar.png"}
            alt={fullName}
            className="h-20 w-20 rounded-full border object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
          />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{fullName}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{roleLabel}</Badge>
              {typeof years === "number" ? (
                <span className="text-sm text-muted-foreground">
                  {years} años de experiencia
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <a href="/profile/setup">Editar</a>
          </Button>
          <span className="text-xs text-muted-foreground">Ajusta tu información y solicita cambios.</span>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Información general</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs">Email</dt>
                <dd className="mt-0.5 text-foreground">{user.email ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs">Ciudad</dt>
                <dd className="mt-0.5 text-foreground">{city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs">Categorías</dt>
                <dd className="mt-0.5 text-foreground">
                  {skills && skills.length > 0
                    ? skills.map((x) => x?.name).filter(Boolean).join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs">Subcategorías</dt>
                <dd className="mt-0.5 text-foreground">
                  {subcats && subcats.length > 0
                    ? subcats.map((x) => x?.name).filter(Boolean).join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {bio && bio.trim().length > 0 ? bio : "Aún no agregas una bio."}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle>Portafolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: tu galería de trabajos aparecerá aquí.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
