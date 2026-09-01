import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadDashboardBootstrap } from './dashboard-bootstrap';
import { getCopy } from './copy';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('dashboard decomposition regression contract', () => {
  it('keeps the dashboard as a composition shell with extracted surfaces and action hooks', () => {
    const dashboard = source('app/dashboard.tsx');
    expect(dashboard).not.toMatch(/\basync function\b/);
    for (const moduleName of [
      'overview-surfaces',
      'capture-surface',
      'measurements-surface',
      'workout-readiness-surface',
      'settings-surface',
      'use-capture-actions',
      'use-measurement-actions',
      'use-workout-actions',
      'use-profile-actions',
      'use-reminder-actions',
      'use-dashboard-query',
    ])
      expect(dashboard).toContain(moduleName);
  });

  it('keeps recovery, offline read-only, navigation, and reduced-motion semantics', () => {
    const dashboard = source('app/dashboard.tsx');
    const notice = source('components/dashboard/notice.tsx');
    const styles = source('app/globals.css');
    expect(dashboard).toContain('disabled={!online}');
    expect(dashboard).toContain(
      "aria-current={page === 'today' ? 'page' : undefined}",
    );
    expect(dashboard).toContain('dashboardRetry');
    expect(notice).toContain("role={tone === 'error' ? 'alert' : 'status'}");
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('provides the S0.6 recovery and confirmation messages in both locales', () => {
    for (const locale of ['en', 'vi'] as const) {
      const feedback = getCopy(locale).feedback;
      for (const key of [
        'measurementSaved',
        'readinessCleared',
        'readinessPaused',
        'planConfirmed',
        'workoutLogReview',
        'workoutLogSaved',
        'dashboardOffline',
        'dashboardPermissionDenied',
        'dashboardRetry',
      ] as const)
        expect(feedback[key].trim().length).toBeGreaterThan(10);
    }
  });
});

describe('dashboard bootstrap access recovery', () => {
  it('classifies owner-access denial before loading any other private resource', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'denied' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await expect(
      loadDashboardBootstrap('2026-09-01', 'load failed', 'sign in again'),
    ).rejects.toMatchObject({
      kind: 'permission',
      message: 'sign in again',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
