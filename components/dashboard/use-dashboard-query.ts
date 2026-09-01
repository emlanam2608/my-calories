import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DashboardBootstrapError,
  loadDashboardBootstrap,
  type DashboardBootstrap,
} from '@/lib/dashboard-bootstrap';
import { bangkokCalendarDate } from '@/lib/dashboard-client';
import { getCopy, type Locale } from '@/lib/copy';

export function useDashboardQuery(
  locale: Locale,
  online: boolean,
  apply: (data: DashboardBootstrap) => void,
) {
  const c = getCopy(locale);
  const date = bangkokCalendarDate();
  const query = useQuery({
    queryKey: ['dashboard-bootstrap', date],
    queryFn: () =>
      loadDashboardBootstrap(
        date,
        c.feedback.loadMealsError,
        c.feedback.dashboardPermissionDenied,
      ),
    enabled: online,
    retry: (failureCount, error) =>
      error instanceof DashboardBootstrapError && error.kind === 'permission'
        ? false
        : failureCount < 1,
  });

  useEffect(() => {
    if (query.data) apply(query.data);
  }, [apply, query.data]);

  const reload = useCallback(async () => {
    if (!online) return;
    await query.refetch({ throwOnError: false });
  }, [online, query]);

  return {
    loading: online && (query.isPending || query.isFetching),
    loadFailure: !online
      ? c.feedback.dashboardOffline
      : query.error instanceof Error
        ? query.error.message
        : '',
    reload,
  };
}
