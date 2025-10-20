import { describe, it, expect } from 'vitest';
import { generateSimpleFolio } from '@/lib/folio';

describe('generateSimpleFolio', () => {
  it('returns HMD-YYYYMMDD-XXXX format (6-char code)', () => {
    const date = new Date('2025-10-08T12:00:00.000Z');
    const folio = generateSimpleFolio('RCPT-EXAMPLE-123', date);
    expect(folio.startsWith('HMD-20251008-')).toBe(true);
    const code = folio.split('-').pop() || '';
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('generates different codes for different ids on same day', () => {
    const date = new Date('2025-10-08T12:00:00.000Z');
    const a = generateSimpleFolio('id-A', date);
    const b = generateSimpleFolio('id-B', date);
    expect(a).not.toEqual(b);
  });
});

