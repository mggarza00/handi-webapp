import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import ProBankAccountsManager from './ProBankAccountsManager.client';

import type { Database } from '@/types/supabase';

type Props = { userId: string; fullName: string };

export default async function BankAccountsCard({ userId, fullName }: Props) {
  const supabase = createServerComponentClient<Database>({ cookies });
  const { data: rows } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, clabe, status, created_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  const initialItems = (rows ?? []).map((r) => {
    const raw = String((r as any).clabe || '').replace(/\D+/g, '');
    const first3 = raw.slice(0, 3);
    const last4 = raw.slice(-4);
    const stars = raw ? '*'.repeat(Math.max(0, raw.length - 7)) : '';
    return {
      id: (r as any).id as string,
      bank_name: (r as any).bank_name as string | null,
      clabe_masked: raw ? `${first3}${stars}${last4}` : null,
      status: (r as any).status as string,
      is_default: ((r as any).status as string) === 'confirmed',
    };
  });

  return (
    <div className="rounded-2xl border p-4 md:p-6">
      <ProBankAccountsManager profileFullName={fullName} initialItems={initialItems} />
    </div>
  );
}
