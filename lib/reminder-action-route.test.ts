import { requestDeduplications } from '@/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ReminderRow = {
  id: string;
  ownerId: string;
  kind: string;
  schedule: { timezone: 'Asia/Bangkok'; time: string; days: Array<'mon'> };
  nextDeliveryAt: Date;
  status: string;
};

const mocks = vi.hoisted(() => ({
  db: undefined as unknown,
  user: null as { userId: string; displayName: string; email: string; fullName: string | null } | null,
}));

vi.mock('@/app/chatgpt-auth', () => ({
  getChatGPTUser: async () => mocks.user,
}));

vi.mock('@/db', () => ({
  getDb: () => mocks.db,
}));

const { PATCH } = await import('@/app/api/reminders/[id]/route');

const reminderId = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c1';
const key = '018e2aaa-6a86-4d9d-b36a-a3d96fd0d0c2';
const owner = { userId: 'owner-a', displayName: 'Owner A', email: 'a@example.test', fullName: 'Owner A' };

function reminderRow(): ReminderRow {
  return {
    id: reminderId,
    ownerId: owner.userId,
    kind: 'workout',
    schedule: { timezone: 'Asia/Bangkok', time: '08:00', days: ['mon'] },
    nextDeliveryAt: new Date('2026-09-07T01:00:00.000Z'),
    status: 'active',
  };
}

function createReminderDb(input: { reminder?: ReminderRow; replay?: { resourceId: string; resourceType: string } } = {}) {
  let reminder = input.reminder;
  const deduplications: Array<{ resourceId: string; resourceType: string }> = input.replay ? [input.replay] : [];
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === requestDeduplications ? deduplications : reminder ? [reminder] : [],
        }),
      }),
    }),
    update: () => ({
      set: (values: Partial<ReminderRow>) => ({
        where: async () => {
          if (reminder) reminder = { ...reminder, ...values };
        },
      }),
    }),
    delete: () => ({ where: async () => { reminder = undefined; } }),
    insert: () => ({
      values: async (value: { resourceId: string; resourceType: string }) => { deduplications.push(value); },
    }),
  };
  return { db, get reminder() { return reminder; }, deduplications };
}

function actionRequest(action: Record<string, unknown>) {
  return new Request(`https://app.test/api/reminders/${reminderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ idempotencyKey: key, ...action }),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('reminder action route security and replay', () => {
  beforeEach(() => {
    mocks.user = owner;
    mocks.db = undefined;
  });

  it('rejects anonymous action requests before database access', async () => {
    mocks.user = null;
    const response = await PATCH(actionRequest({ action: 'pause' }), { params: Promise.resolve({ id: reminderId }) });
    expect(response.status).toBe(401);
    expect(mocks.db).toBeUndefined();
  });

  it('returns a full owner-scoped reminder for each non-delete replay', async () => {
    const actions = [
      { action: 'pause' },
      { action: 'resume' },
      { action: 'snooze', minutes: 30 },
      { action: 'reschedule', schedule: { timezone: 'Asia/Bangkok', time: '09:00', days: ['mon'] } },
    ];
    for (const action of actions) {
      const state = createReminderDb({ reminder: reminderRow(), replay: { resourceId: reminderId, resourceType: 'reminder_action' } });
      mocks.db = state.db;
      const response = await PATCH(actionRequest(action), { params: Promise.resolve({ id: reminderId }) });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ replayed: true, reminder: { id: reminderId, status: 'active' } });
      expect(state.deduplications).toHaveLength(1);
    }
  });

  it('replays delete safely after the owner reminder has been removed', async () => {
    const state = createReminderDb({ replay: { resourceId: reminderId, resourceType: 'reminder_action' } });
    mocks.db = state.db;
    const response = await PATCH(actionRequest({ action: 'delete' }), { params: Promise.resolve({ id: reminderId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: reminderId, deleted: true, replayed: true });
  });

  it('does not reveal a different owner reminder and rejects a mismatched replay key', async () => {
    const hidden = createReminderDb();
    mocks.db = hidden.db;
    const missing = await PATCH(actionRequest({ action: 'pause' }), { params: Promise.resolve({ id: reminderId }) });
    expect(missing.status).toBe(404);

    const mismatched = createReminderDb({ reminder: reminderRow(), replay: { resourceId: reminderId, resourceType: 'measurement' } });
    mocks.db = mismatched.db;
    const conflict = await PATCH(actionRequest({ action: 'pause' }), { params: Promise.resolve({ id: reminderId }) });
    expect(conflict.status).toBe(409);
  });

  it('mutates and returns an updated reminder for each action', async () => {
    const actions = [
      { action: 'pause' },
      { action: 'resume' },
      { action: 'snooze', minutes: 30 },
      { action: 'reschedule', schedule: { timezone: 'Asia/Bangkok', time: '09:00', days: ['mon'] } },
      { action: 'delete' },
    ];
    for (const action of actions) {
      const state = createReminderDb({ reminder: reminderRow() });
      mocks.db = state.db;
      const response = await PATCH(actionRequest(action), { params: Promise.resolve({ id: reminderId }) });
      expect(response.status).toBe(200);
      const body = await response.json() as { reminder?: { id: string }; deleted?: boolean };
      if (action.action === 'delete') expect(body.deleted).toBe(true);
      else expect(body.reminder?.id).toBe(reminderId);
      expect(state.deduplications).toHaveLength(1);
    }
  });
});
