import { describe, expect, it } from 'vitest';
import { createDashboardQueryClient } from './query-client';

describe('dashboard query policy', () => {
  it('caches reads briefly and never pauses mutations for offline replay', () => {
    const options = createDashboardQueryClient().getDefaultOptions();
    expect(options.queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    });
    expect(options.mutations).toMatchObject({
      networkMode: 'always',
      retry: 0,
    });
  });
});
