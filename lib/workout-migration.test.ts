import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { describe, expect, it } from 'vitest';

async function apply(database: Awaited<ReturnType<Miniflare['getD1Database']>>, file: string) {
  const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean))
    await database.prepare(statement).run();
}

describe('workout lifecycle and evidence migrations', () => {
  it('upgrades multiple legacy confirmed plans and aggregate logs without drift', async () => {
    const worker = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response() } }', d1Databases: ['DB'] });
    const database = await worker.getD1Database('DB');
    try {
      const directory = fileURLToPath(new URL('../drizzle/', import.meta.url));
      const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
      for (const file of files.filter((file) => file < '0024')) await apply(database, file);
      const plan = JSON.stringify({
        planVersion: 'starter-plan-1', periodStart: '2026-09-01',
        sessions: [{ id: 'legacy-session', dayOffset: 0, title: { en: 'Legacy', vi: 'Cũ' }, durationMinutes: 20, rpe: 4, rationale: { en: 'Legacy reason', vi: 'Lý do cũ' }, exerciseIds: ['sit-to-stand'], safetyNote: { en: 'Stop if unwell.', vi: 'Dừng nếu không khỏe.' } }],
      });
      await database.prepare('insert into workout_plans (id, owner_id, plan_version, period_start, status, plan, created_at, confirmed_at) values (?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd00de1', 'owner-a', 'starter-plan-1', '2026-09-01', 'confirmed', plan, 1, 1).run();
      await database.prepare('insert into workout_plans (id, owner_id, plan_version, period_start, status, plan, created_at, confirmed_at) values (?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd00de2', 'owner-a', 'starter-plan-1', '2026-09-08', 'confirmed', plan, 2, 2).run();
      await database.prepare('insert into workout_sessions (id, owner_id, plan_id, session_id, plan_version, status, duration_minutes, rpe, pain, concerning_symptoms, completed_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd00de3', 'owner-a', '018e2aaa-6a86-4d9d-b36a-a3d96fd00de1', 'legacy-session', 'starter-plan-1', 'completed', 20, 4, 0, 0, 3).run();
      await apply(database, '0024_workout_plan_preview_lifecycle.sql');
      await apply(database, '0025_workout_exercise_evidence.sql');
      await apply(database, '0026_workout_adaptation_proposals.sql');
      const plans = await database.prepare('select id, status from workout_plans order by created_at').all<{ id: string; status: string }>();
      expect(plans.results).toEqual([
        { id: '018e2aaa-6a86-4d9d-b36a-a3d96fd00de1', status: 'superseded' },
        { id: '018e2aaa-6a86-4d9d-b36a-a3d96fd00de2', status: 'active' },
      ]);
      const log = await database.prepare('select evidence_version, data_completeness, adherence_status from workout_sessions where id = ?').bind('018e2aaa-6a86-4d9d-b36a-a3d96fd00de3').first<Record<string, string>>();
      expect(log).toEqual({ evidence_version: 'legacy-aggregate-1', data_completeness: 'legacy_aggregate', adherence_status: 'legacy_unknown' });
      expect((await database.prepare("select count(*) as count from sqlite_master where type = 'table' and name = 'workout_adaptation_proposals'").first<{ count: number }>())?.count).toBe(1);
    } finally {
      await worker.dispose();
    }
  }, 60_000);
});
