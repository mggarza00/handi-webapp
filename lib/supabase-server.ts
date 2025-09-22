/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: any) {
          cookieStore.set({
            name,
            value,
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            domain: process.env.NODE_ENV === 'production' ? 'handi.mx' : undefined,
          })
        },
        remove(name: string, options: any) {
          cookieStore.set({
            name,
            value: '',
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: new Date(0),
            sameSite: 'lax',
            domain: process.env.NODE_ENV === 'production' ? 'handi.mx' : undefined,
          })
        },
      },
    }
  )
}
/* eslint-disable @typescript-eslint/no-explicit-any */
