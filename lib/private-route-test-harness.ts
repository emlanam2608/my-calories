export type TestUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export const routeTestUsers = {
  ownerA: {
    userId: 'owner-a',
    displayName: 'Owner A',
    email: 'owner-a@example.test',
    fullName: 'Owner A',
  },
  ownerB: {
    userId: 'owner-b',
    displayName: 'Owner B',
    email: 'owner-b@example.test',
    fullName: 'Owner B',
  },
} as const satisfies Record<string, TestUser>;

export function privateRouteRequest(path: string, init: RequestInit = {}, user: TestUser | null = routeTestUsers.ownerA) {
  const headers = new Headers(init.headers);
  if (user) {
    headers.set('oai-authenticated-user-id', user.userId);
    headers.set('oai-authenticated-user-email', user.email);
  }
  return new Request(`https://app.test${path}`, { ...init, headers });
}

/**
 * Minimal owner-scoped query fixture for route tests. Tests seed the exact rows
 * visible to the selected owner; this keeps route authorization tests focused on
 * server response behavior instead of reproducing Drizzle internals.
 */
export function createFakeRouteDb(seed: unknown[] | { rows?: unknown[]; rowsByTable?: Map<unknown, unknown[]> } = []) {
  const options = Array.isArray(seed) ? { rows: seed } : seed;
  const state = { rows: [...(options.rows ?? [])], rowsByTable: options.rowsByTable ?? new Map<unknown, unknown[]>() };
  return {
    state,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            const rows = [...(state.rowsByTable.get(table) ?? state.rows)];
            const query = Object.assign(rows, { limit: async (count: number) => rows.slice(0, count) });
            return Object.assign(query, { orderBy: () => query });
          },
        }),
      }),
    },
  };
}

export function createFakePrivateObjects(initial: Record<string, Uint8Array> = {}) {
  const objects = new Map(Object.entries(initial));
  const getCalls: string[] = [];
  const deleteCalls: string[] = [];
  return {
    getCalls,
    deleteCalls,
    has: (key: string) => objects.has(key),
    FILES: {
      get: async (key: string) => {
        getCalls.push(key);
        const bytes = objects.get(key);
        if (!bytes) return null;
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return { body: new Blob([copy.buffer]).stream() };
      },
      put: async (key: string, value: Uint8Array) => { objects.set(key, value); },
      delete: async (key: string) => {
        deleteCalls.push(key);
        objects.delete(key);
      },
    },
  };
}

/** Creates a disposable D1 binding migrated from the repository SQL files. */
export async function createMigratedRouteDb() {
  const worker = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response() } }',
    d1Databases: ['DB'],
  });
  const database = await worker.getD1Database('DB');
  const migrationsDirectory = fileURLToPath(new URL('../drizzle/', import.meta.url));
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean))
      await database.prepare(statement).run();
  }
  return {
    database,
    db: drizzle(database, { schema }),
    dispose: async () => worker.dispose(),
  };
}
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/d1';
import { Miniflare } from 'miniflare';
import * as schema from '@/db/schema';
