import { describe, it, expect } from 'vitest';
import { appendAttachment, removeAttachment } from '@/components/chat/utils';

describe('chat attachments state utils', () => {
  it('appendAttachment appends to specific message without touching others', () => {
    const prev: Array<{ id: string; attachments?: Array<{ id?: string; filename: string; mime_type: string; storage_path: string }> }> = [
      { id: 'm1', attachments: [{ id: 'a1', filename: 'x.png', mime_type: 'image/png', storage_path: 'p1' }] },
      { id: 'm2', attachments: [] },
    ];
    const out = appendAttachment(prev, 'm2', { id: 'a2', filename: 'y.pdf', mime_type: 'application/pdf', storage_path: 'p2' });
    expect(out.find((m) => m.id === 'm1')?.attachments?.length).toBe(1);
    expect(out.find((m) => m.id === 'm2')?.attachments?.length).toBe(1);
    expect(out.find((m) => m.id === 'm2')?.attachments?.[0].id).toBe('a2');
  });

  it('removeAttachment removes only the targeted attachment', () => {
    const prev: Array<{ id: string; attachments?: Array<{ id?: string; filename: string; mime_type: string; storage_path: string }> }> = [
      { id: 'm1', attachments: [{ id: 'a1', filename: 'x.png', mime_type: 'image/png', storage_path: 'p1' }] },
      { id: 'm2', attachments: [{ id: 'a2', filename: 'y.pdf', mime_type: 'application/pdf', storage_path: 'p2' }] },
    ];
    const out = removeAttachment(prev, 'm2', 'a2');
    expect(out.find((m) => m.id === 'm2')?.attachments?.length).toBe(0);
    expect(out.find((m) => m.id === 'm1')?.attachments?.length).toBe(1);
  });

  it('appendAttachment creates attachments array when missing', () => {
    const prev: Array<{ id: string; attachments?: Array<{ id?: string; filename: string; mime_type: string; storage_path: string }> }> = [{ id: 'm1' }];
    const out = appendAttachment(prev, 'm1', { filename: 'x', mime_type: 'text/plain', storage_path: 'k' });
    expect(out[0].attachments?.length).toBe(1);
  });
});
