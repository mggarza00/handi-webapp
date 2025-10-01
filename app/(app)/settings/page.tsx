import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

import BankAccountsCard from './components/BankAccountsCard';

import type { Database } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = createServerComponentClient<Database>({ cookies });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_client_pro, full_name')
    .eq('id', user.id)
    .single();
  if (error) redirect('/login');

  const isPro = profile?.role === 'professional' || profile?.is_client_pro === true;

  return (
    <main className="mx-auto w-full max-w-2xl p-6 space-y-6">
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
        <BankAccountsCard userId={user.id} fullName={profile?.full_name ?? ''} />
      ) : null}
    </main>
  );
}
