import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import createClient from "@/utils/supabase/server";

import BankAccountsCard from './components/BankAccountsCard';
import EnableNotificationsButton from "@/components/EnableNotificationsButton";

import type { Database } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_client_pro, full_name')
    .eq('id', user.id)
    .single();
  if (error) redirect('/login');

  const isPro = (profile as any)?.role === 'professional' || (profile as any)?.is_client_pro === true;

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
        </CardContent>
      </Card>

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

      {isPro ? (
        <BankAccountsCard userId={user.id} fullName={(profile as any)?.full_name ?? ''} />
      ) : null}
    </main>
  );
}
