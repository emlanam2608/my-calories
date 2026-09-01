import { createMigratedRouteDb } from './private-route-test-harness';
import { describe, expect, it } from 'vitest';

describe('D1 migrations', () => {
  it('apply cleanly to an empty Cloudflare D1 binding', async () => {
    const routeDb = await createMigratedRouteDb();

    try {
      const result = await routeDb.database
        .prepare("select name from sqlite_master where type = 'table' and name in ('uploads', 'saved_foods', 'measurements', 'reminders', 'request_deduplications') order by name")
        .all<{ name: string }>();
      expect(result.results.map((row) => row.name)).toEqual([
        'measurements',
        'reminders',
        'request_deduplications',
        'saved_foods',
        'uploads',
      ]);
    } finally {
      await routeDb.dispose();
    }
  }, 60_000);
});
