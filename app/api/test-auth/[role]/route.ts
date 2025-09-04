import { NextResponse } from 'next/server';

export async function GET(_: Request, { params }: { params: Promise<{ role: string }> }) {
  const allowed = process.env.NODE_ENV !== 'production' || process.env.CI === 'true';
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN_IN_PROD' }, { status: 403 });
  }

  const { role: r } = await params;
  const role = String(r || 'guest').toLowerCase();
  if (!['guest','client','professional','admin'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'INVALID_ROLE' }, { status: 400 });
  }

  const res = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  res.cookies.set('handee_role', role, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60, path: '/' });
  return res;
}
