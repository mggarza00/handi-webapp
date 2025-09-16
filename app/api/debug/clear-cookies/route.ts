import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }

  const store = cookies()
  const all = store.getAll()
  const res = NextResponse.json({
    cleared: all.map((c) => c.name),
    count: all.length,
    note: 'Clears cookies by expiring them; dev-only endpoint.'
  })

  // Expire each cookie at root path
  for (const c of all) {
    res.cookies.set({ name: c.name, value: '', path: '/', expires: new Date(0) })
  }

  return res
}

export async function POST() {
  return GET()
}

