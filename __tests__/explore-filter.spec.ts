import { describe, expect, it } from 'vitest';
import { filterExplorableRequests, type ExploreRow } from '@/app/(site)/(main-site)/requests/explore/_lib/filter';

describe('filterExplorableRequests', () => {
  it('excludes scheduled requests from explore', () => {
    const rows: ExploreRow[] = [
      { id: '1', status: 'active' },
      { id: '2', status: 'scheduled' },
      { id: '3', status: 'in_process' },
      { id: '4', status: 'finished' },
      { id: '5', status: 'completed' },
      { id: '6', status: 'active', is_explorable: false },
    ];
    const out = filterExplorableRequests(rows);
    const ids = out.map((r) => r.id);
    expect(ids).toEqual(['1']);
  });
});
