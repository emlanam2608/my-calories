import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isTable } from 'drizzle-orm';
import { getTableConfig, type AnySQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import * as schema from '@/db/schema';
import { createMigratedRouteDb } from './private-route-test-harness';

type DatabaseColumn = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type DatabaseIndex = {
  name: string;
  unique: number;
  origin: string;
};

const migrationDirectory = fileURLToPath(new URL('../drizzle/', import.meta.url));
const applicationTables = Object.values(schema).filter(isTable) as AnySQLiteTable[];

function expectedColumns(table: AnySQLiteTable) {
  return getTableConfig(table).columns.map((column) => ({
    name: column.name,
    type: column.getSQLType().toUpperCase(),
    notNull: column.notNull,
    hasDefault: column.hasDefault,
    primary: column.primary,
  })).sort((left, right) => left.name.localeCompare(right.name));
}

function expectedIndexes(table: AnySQLiteTable) {
  const config = getTableConfig(table);
  const explicit = config.indexes.map((index) => ({
    name: index.config.name,
    unique: index.config.unique,
    columns: index.config.columns.map((column) => ('name' in column ? column.name : '')).filter(Boolean),
  }));
  const columnUnique = config.columns
    .filter((column) => column.isUnique && column.uniqueName)
    .map((column) => ({ name: column.uniqueName!, unique: true, columns: [column.name] }));
  return [...explicit, ...columnUnique].sort((left, right) => left.name.localeCompare(right.name));
}

describe('SQL-first migration workflow', () => {
  it('keeps journal metadata aligned with every ordered, immutable SQL migration', async () => {
    const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort();
    const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as {
      entries: Array<{ idx: number; tag: string; breakpoints: boolean }>;
    };

    expect(journal.entries.map((entry) => entry.tag)).toEqual(files.map((file) => file.slice(0, -4)));
    expect(journal.entries.map((entry) => entry.idx)).toEqual(files.map((_, index) => index));
    expect(journal.entries.every((entry) => entry.breakpoints)).toBe(true);
  });

  it('matches every application table, column default, and explicit index after a clean D1 migration', async () => {
    const routeDb = await createMigratedRouteDb();
    try {
      const tables = await routeDb.database.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' order by name").all<{ name: string }>();
      const expectedTableNames = applicationTables.map((table) => getTableConfig(table).name).sort();
      expect(tables.results.map((table) => table.name)).toEqual(expectedTableNames);

      for (const table of applicationTables) {
        const config = getTableConfig(table);
        const actualColumns = await routeDb.database.prepare(`pragma table_info('${config.name}')`).all<DatabaseColumn>();
        expect(actualColumns.results.map((column) => ({
          name: column.name,
          type: column.type.toUpperCase(),
          notNull: Boolean(column.notnull),
          hasDefault: column.dflt_value !== null,
          primary: column.pk > 0,
        })).sort((left, right) => left.name.localeCompare(right.name))).toEqual(expectedColumns(table));

        const actualIndexRows = await routeDb.database.prepare(`pragma index_list('${config.name}')`).all<DatabaseIndex>();
        const actualIndexes = await Promise.all(actualIndexRows.results
          .filter((index) => index.origin !== 'pk')
          .map(async (index) => {
            const columns = await routeDb.database.prepare(`pragma index_info('${index.name}')`).all<{ name: string }>();
            return { name: index.name, unique: Boolean(index.unique), columns: columns.results.map((column) => column.name) };
          }));
        expect(actualIndexes.sort((left, right) => left.name.localeCompare(right.name))).toEqual(expectedIndexes(table));
      }
    } finally {
      await routeDb.dispose();
    }
  }, 60_000);
});
