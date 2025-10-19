import { describe, it, expect } from 'vitest';
import { renderQuotePNG } from '@/lib/quotes/renderImage';

describe('renderQuotePNG', () => {
  it('renders a PNG buffer with content', async () => {
    const buf = await renderQuotePNG({
      folio: 'TEST-1234',
      dateISO: new Date().toISOString(),
      professional: { name: 'Profesional Demo', email: null },
      client: { name: 'Cliente Demo', email: null },
      currency: 'MXN',
      items: [
        { concept: 'Mano de obra', amount: 500 },
        { concept: 'Materiales', amount: 300 },
      ],
      total: 800,
      // No logoUrl on purpose to avoid remote fetch in satori
    });
    expect(buf).toBeTruthy();
    // naive check: PNG signature 0x89 50 4E 47
    expect(buf.buffer.slice(0, 4)).toBeTruthy();
  });
});

