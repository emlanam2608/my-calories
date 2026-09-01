import { describe, expect, it } from 'vitest';
import { nextReminderDelivery, snoozedReminderDelivery } from './reminder-scheduling';

describe('nextReminderDelivery', () => {
  it('uses Asia/Bangkok local time and moves to the next selected day', () => {
    const next = nextReminderDelivery(
      { timezone: 'Asia/Bangkok', time: '08:00', days: ['mon', 'wed'] },
      new Date('2026-08-31T02:00:00.000Z'), // Monday 09:00 Bangkok
    );
    expect(next.toISOString()).toBe('2026-09-02T01:00:00.000Z');
  });

  it('can schedule later today in Bangkok', () => {
    const next = nextReminderDelivery(
      { timezone: 'Asia/Bangkok', time: '18:30', days: ['mon'] },
      new Date('2026-08-31T02:00:00.000Z'),
    );
    expect(next.toISOString()).toBe('2026-08-31T11:30:00.000Z');
  });

  it('defers a scheduled reminder to the end of Bangkok quiet hours', () => {
    const next = nextReminderDelivery(
      { timezone: 'Asia/Bangkok', time: '22:00', days: ['mon'], quietHours: { start: '21:30', end: '07:00' } },
      new Date('2026-08-31T02:00:00.000Z'),
    );
    expect(next.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('keeps a snooze out of quiet hours', () => {
    const next = snoozedReminderDelivery(
      { timezone: 'Asia/Bangkok', time: '08:00', days: ['mon'], quietHours: { start: '21:30', end: '07:00' } },
      60,
      new Date('2026-08-31T13:30:00.000Z'), // 20:30 Bangkok
    );
    expect(next.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});
