import { QueryClient } from '@tanstack/react-query';

/** Read caching is allowed; mutations execute immediately and are never paused for replay. */
export function createDashboardQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        networkMode: 'always',
        retry: 0,
      },
    },
  });
}
