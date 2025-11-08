#!/usr/bin/env node
/**
 * Falla si encuentra usos directos de createRouteHandlerClient/createServerClient
 * fuera de nuestros wrappers oficiales.
 */
/* eslint-disable no-console */
const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

const root = process.cwd()
const allowlist = new Set([
  'lib/supabase/route-client.ts',
  'lib/supabase/server-client.ts',
  'utils/supabase/middleware.ts',
  'middleware.ts',
])

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.startsWith('node_modules/') && !f.startsWith('public/') && !f.startsWith('scripts/'))

const offenders = []
for (const f of files) {
  if (allowlist.has(f)) continue
  const full = join(root, f)
  let src = ''
  try {
    src = readFileSync(full, 'utf8')
  } catch {
    continue
  }
  const hasAuthHelpers = /from\s+['"]@supabase\/auth-helpers-nextjs['"]/.test(src)
  const hasCreateRouteHandlerClient = src.includes('createRouteHandlerClient(')
  const hasSSRClient = /from\s+['"]@supabase\/ssr['"]/.test(src) && src.includes('createServerClient(')
  const hasLegacyUtils = src.includes("from '@/utils/supabase/server'")
  if (hasAuthHelpers) offenders.push({ file: f, why: '@supabase/auth-helpers-nextjs import' })
  if (hasCreateRouteHandlerClient) offenders.push({ file: f, why: 'createRouteHandlerClient' })
  if (hasSSRClient) offenders.push({ file: f, why: 'createServerClient from @supabase/ssr' })
  if (hasLegacyUtils) offenders.push({ file: f, why: 'utils/supabase/server import' })
}

if (offenders.length) {
  console.error('[check-supabase-client-usage] Found disallowed usages:')
  for (const o of offenders) console.error(` - ${o.file} :: ${o.why}`)
  process.exit(1)
}

console.log('[check-supabase-client-usage] OK — all wrappers in place')
