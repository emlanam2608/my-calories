# Database migration workflow

Nourishwell uses an SQL-first migration workflow for Cloudflare D1. The committed SQL files in `drizzle/` are the source of truth for applied schema history; `drizzle/meta/_journal.json` records their ordered Drizzle metadata. We intentionally do not maintain hand-written Drizzle snapshot JSON files.

## Rules

1. Never edit an applied migration. Add the next numbered SQL migration for any schema correction.
2. Update `db/schema.ts`, add the next `drizzle/NNNN_description.sql`, and update `drizzle/meta/_journal.json` in the same change.
3. Keep journal tags exactly equal to the ordered SQL filenames without `.sql`, with zero-based sequential `idx` values and `breakpoints: true`.
4. Run `npm test` before handoff. `lib/migration-integrity.test.ts` applies all SQL to a clean Miniflare D1 database and compares the resulting tables, columns, defaults, and explicit indexes to `db/schema.ts`.
5. Run `npx tsc --noEmit --incremental false`, `npm run build`, and `git diff --check` for every schema change.

`npm run db:generate` is not part of the routine workflow because it would introduce snapshot-driven changes. Use it only in a dedicated, reviewed migration-tooling change that updates this document and preserves the clean-D1 contract test.
