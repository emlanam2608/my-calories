import { useCallback } from 'react';
import type { Reminder } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';
import { createDashboardRequestId } from '@/lib/dashboard-client';

export type ReminderAction =
  | { action: 'pause' | 'resume' | 'delete' }
  | { action: 'snooze'; minutes: 15 | 30 | 60 | 180 }
  | { action: 'reschedule'; schedule: Reminder['schedule'] };

type SetString = (value: string) => void;
type SetReminders = (update: (current: Reminder[]) => Reminder[]) => void;

export function useReminderActions(locale: Locale, setReminders: SetReminders, setNotice: SetString) {
  const c = getCopy(locale);
  const createReminder = useCallback(async (reminder: Omit<Reminder, 'id' | 'nextDeliveryAt' | 'status'>) => {
    const response = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: createDashboardRequestId(), ...reminder }) });
    const body = await response.json() as { error?: string; reminder?: Reminder };
    if (!response.ok || !body.reminder) throw new Error(body.error || c.feedback.reminderSaveError);
    setReminders((current) => [body.reminder!, ...current]);
    setNotice(c.feedback.reminderSaved);
  }, [c.feedback.reminderSaveError, c.feedback.reminderSaved, setNotice, setReminders]);
  const actOnReminder = useCallback(async (reminder: Reminder, action: ReminderAction) => {
    const response = await fetch(`/api/reminders/${reminder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotencyKey: createDashboardRequestId(), ...action }) });
    const body = await response.json() as { error?: string; reminder?: Reminder };
    if (!response.ok || (action.action !== 'delete' && !body.reminder)) throw new Error(body.error || c.feedback.reminderUpdateError);
    setReminders((current) => action.action === 'delete' ? current.filter((item) => item.id !== reminder.id) : current.map((item) => item.id === reminder.id ? body.reminder! : item));
    setNotice(action.action === 'delete' ? c.feedback.reminderDeleted : action.action === 'pause' ? c.feedback.reminderPaused : action.action === 'resume' ? c.feedback.reminderResumed : action.action === 'snooze' ? c.feedback.reminderSnoozed : c.feedback.reminderRescheduled);
  }, [c.feedback.reminderDeleted, c.feedback.reminderPaused, c.feedback.reminderRescheduled, c.feedback.reminderResumed, c.feedback.reminderSnoozed, c.feedback.reminderUpdateError, setNotice, setReminders]);
  return { createReminder, actOnReminder };
}
