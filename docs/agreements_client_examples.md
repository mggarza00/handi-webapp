# Agreements – client examples under RLS

Below are minimal examples using supabase-js and PostgREST HTTP. RLS policies from the SQL ensure only the requester (who created the request) and the assigned professional can read/write.

## supabase-js

```ts
// Create client once
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// 1) Insert agreement (as requester or professional)
export async function createAgreement({ requestId, professionalId, amount }: {
  requestId: string; professionalId: string; amount?: number;
}) {
  const { data, error } = await supabase
    .from('agreements')
    .insert([{ request_id: requestId, professional_id: professionalId, amount }])
    .select('*')
    .single()
  if (error) throw error
  return data
}

// 2) Update status (either party)
export async function updateAgreementStatus(id: string, status: 'negotiating' | 'accepted' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'disputed') {
  const { data, error } = await supabase
    .from('agreements')
    .update({ status })
    .eq('id', id)
    .select('id, status, updated_at')
    .single()
  if (error) throw error
  return data
}

// 3) List my visible agreements (RLS filters automatically)
export async function listMyAgreements(limit = 50) {
  const { data, error } = await supabase
    .from('agreements')
    .select('id, request_id, professional_id, amount, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// 4) Optional: fetch with related request (if FK and request RLS allow it)
// Note: nested selects require a named FK; adjust relation name if needed.
export async function listWithRequest(limit = 50) {
  const { data, error } = await supabase
    .from('agreements')
    .select('id, status, created_at, request:requests(id, created_by)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
```

## HTTP (PostgREST)

Use the user JWT in `Authorization: Bearer <jwt>` so RLS applies.

```bash
# Insert
curl -X POST "$SUPABASE_URL/rest/v1/agreements" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "request_id": "00000000-0000-0000-0000-000000000000",
    "professional_id": "11111111-1111-1111-1111-111111111111",
    "amount": 120
  }'

# Update status
curl -X PATCH "$SUPABASE_URL/rest/v1/agreements?id=eq.33333333-3333-3333-3333-333333333333" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{ "status": "accepted" }'

# List (RLS restricts)
curl "$SUPABASE_URL/rest/v1/agreements?select=id,request_id,professional_id,amount,status,created_at&order=created_at.desc&limit=50" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT"
```

Notes
- RLS: no service_role keys on the client; use anon key + user JWT session.
- Errors like 401/403 usually mean the policy denied the action or the JWT is missing.
- Ensure `public.requests` has policies that let the requester see its own rows if you do joins.

