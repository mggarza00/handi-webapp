import { redirect } from "next/navigation";

import AddressesCard from "./components/AddressesCard";
import BankAccountsCard from "./components/BankAccountsCard";
import EmailNotificationsToggle from "./components/EmailNotificationsToggle.client";

import EnableNotificationsButton from "@/components/EnableNotificationsButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/types/supabase";
import createClient from "@/utils/supabase/server";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name"
>;

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile, error }, { data: professional }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single<ProfileRow>(),
    supabase
      .from("professionals")
      .select("id, active")
      .eq("id", user.id)
      .maybeSingle<{ id: string; active: boolean | null }>(),
  ]);
  if (error) redirect("/login");

  const isPro = Boolean(professional?.id) && professional?.active === true;
  const fullName =
    typeof profile?.full_name === "string" ? profile.full_name : "";

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Notificaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Activa las notificaciones push para recibir avisos importantes.
          </p>
          <EnableNotificationsButton
            publicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || ""}
            labelEnable="Activar notificaciones"
            labelEnabled="Notificaciones activas"
          />
          <div className="my-4 h-px bg-border" />
          <EmailNotificationsToggle />
        </CardContent>
      </Card>

      {/* Direcciones guardadas */}
      <AddressesCard />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl">Apariencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Night mode deshabilitado temporalmente.
          </p>
        </CardContent>
      </Card>

      {isPro ? <BankAccountsCard userId={user.id} fullName={fullName} /> : null}
    </main>
  );
}
