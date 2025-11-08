#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])
const IGNORE_DIRS = new Set([
  'node_modules', '.next', '.git', 'test-results', 'artifacts', 'public', 'supabase', 'snapshots', 'scripts'
])
const ALLOWLIST = new Set([
  'lib/supabase/route-client.ts',
  'lib/supabase/server-client.ts',
  'utils/supabase/middleware.ts',
  'utils/supabase/server.ts',
  'middleware.ts',
])

/** @param {string} p */
function shouldScan(p) {
  const parts = p.split(/[/\\]/)
  return !parts.some((seg) => IGNORE_DIRS.has(seg))
}

/** @param {string} p */
function shouldCheckFile(p) {
  const ext = p.slice(p.lastIndexOf('.'))
  return EXTS.has(ext)
}

/** Collect files */
const files = []
;(function walk(dir) {
  if (!shouldScan(relative(ROOT, dir))) return
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full)
    else if (st.isFile() && shouldCheckFile(full)) files.push(full)
  }
})(ROOT)

const offenders = []
for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/')
  const allow = ALLOWLIST.has(rel)
  const src = readFileSync(f, 'utf8')
  if (!allow) {
    if (src.includes('createRouteHandlerClient(')) offenders.push({ file: rel, why: 'createRouteHandlerClient' })
    if (/from\s+['"]@supabase\/auth-helpers-nextjs['"]/.test(src)) offenders.push({ file: rel, why: '@supabase/auth-helpers-nextjs import' })
    if (src.includes("from '@supabase/ssr'") && src.includes('createServerClient(')) offenders.push({ file: rel, why: 'createServerClient from @supabase/ssr' })
    if (src.includes("from '@/utils/supabase/server'")) offenders.push({ file: rel, why: 'utils/supabase/server import' })
  }
}

if (offenders.length) {
  console.error('[verify-supabase-wrappers] Found disallowed usages:')
  for (const o of offenders) console.error(` - ${o.file} :: ${o.why}`)
  process.exit(1)
}

console.log('[verify-supabase-wrappers] OK — all wrappers in place')
