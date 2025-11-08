'use server'

import { cookies } from 'next/headers'

/**
 * Expira posibles cookies antiguas del nombre por defecto de Supabase.
 * Úsalo manualmente una sola vez en dev si sigues viendo sesiones "raras".
 */
export async function expireLegacyAuthCookie(name = 'sb-') {
  try {
    const jar = cookies()
    const legacyNames = new Set<string>([
      'supabase-auth-token',
      'sb-access-token',
      'sb-refresh-token',
      'sb-provider-token',
      'sb-provider-refresh-token',
      'sb:token',
    ])
    const all = jar.getAll()
    for (const c of all) {
      const n = c.name
      if (n.startsWith(name) || legacyNames.has(n)) {
        jar.set(n, '', { path: '/', maxAge: 0, expires: new Date(0) })
      }
    }
  } catch {
    // best effort; ignora errores en contextos donde no se permite escribir cookies
  }
}

