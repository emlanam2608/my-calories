import { Check, LoaderCircle } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Reminder } from '@/lib/contracts';
import { getCopy, type Locale } from '@/lib/copy';

type ReminderAction =
  | { action: 'pause' | 'resume' | 'delete' }
  | { action: 'snooze'; minutes: 15 | 30 | 60 | 180 }
  | { action: 'reschedule'; schedule: Reminder['schedule'] };
export function RemindersPanel({
  locale,
  reminders,
  onAction,
  onCreate,
}: {
  locale: Locale;
  reminders: Reminder[];
  onAction: (reminder: Reminder, action: ReminderAction) => Promise<void>;
  onCreate: (
    reminder: Omit<Reminder, 'id' | 'nextDeliveryAt' | 'status'>,
  ) => Promise<void>;
}) {
  const c = getCopy(locale);
  const [kind, setKind] = useState<Reminder['kind']>('meal');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState<Reminder['schedule']['days']>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);
  const [quiet, setQuiet] = useState(false);
  const [start, setStart] = useState('21:30');
  const [end, setEnd] = useState('07:00');
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const labels: Record<Reminder['kind'], string> = {
    meal: c.reminders.meal,
    workout: c.reminders.workout,
    measurement: c.reminders.measurement,
    weekly_review: c.reminders.weeklyReview,
  };
  const dayLabels: Record<Reminder['schedule']['days'][number], string> = {
    mon: c.onboarding.dayMon,
    tue: c.onboarding.dayTue,
    wed: c.onboarding.dayWed,
    thu: c.onboarding.dayThu,
    fri: c.onboarding.dayFri,
    sat: c.onboarding.daySat,
    sun: c.onboarding.daySun,
  };
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!days.length) {
      setError(c.feedback.reminderDaysRequired);
      return;
    }
    setSaving(true);
    setError('');
    const schedule = {
      timezone: 'Asia/Bangkok' as const,
      time,
      days,
      ...(quiet ? { quietHours: { start, end } } : {}),
    };
    try {
      if (editing) {
        await onAction(editing, { action: 'reschedule', schedule });
        setEditing(null);
      } else await onCreate({ kind, schedule });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : c.feedback.reminderSaveError,
      );
    } finally {
      setSaving(false);
    }
  }
  function edit(reminder: Reminder) {
    setEditing(reminder);
    setKind(reminder.kind);
    setTime(reminder.schedule.time);
    setDays(reminder.schedule.days);
    setQuiet(Boolean(reminder.schedule.quietHours));
    setStart(reminder.schedule.quietHours?.start ?? '21:30');
    setEnd(reminder.schedule.quietHours?.end ?? '07:00');
    setError('');
  }
  return (
    <Card className="mt-7 border-none shadow-sm">
      <CardHeader>
        <CardTitle>{c.reminders.title}</CardTitle>
        <CardDescription>{c.reminders.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              {c.reminders.kind}
              <select
                disabled={Boolean(editing)}
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as Reminder['kind'])
                }
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                {(Object.keys(labels) as Reminder['kind'][]).map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              {c.reminders.time}
              <Input
                className="mt-2 bg-white"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{c.reminders.days}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                Object.keys(dayLabels) as Reminder['schedule']['days'][number][]
              ).map((day) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={days.includes(day) ? 'secondary' : 'outline'}
                  onClick={() =>
                    setDays((current) =>
                      current.includes(day)
                        ? current.filter((item) => item !== day)
                        : [...current, day],
                    )
                  }
                >
                  {dayLabels[day]}
                </Button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={quiet}
              onChange={(event) => setQuiet(event.target.checked)}
            />
            {c.reminders.quietHours}
          </label>
          {quiet ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                {c.reminders.quietStart}
                <Input
                  type="time"
                  className="mt-2 bg-white"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                {c.reminders.quietEnd}
                <Input
                  type="time"
                  className="mt-2 bg-white"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  required
                />
              </label>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-800 hover:bg-emerald-900"
            >
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin" /> {c.reminders.saving}
                </>
              ) : (
                <>
                  <Check /> {editing ? c.reminders.update : c.reminders.save}
                </>
              )}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                {c.common.cancel}
              </Button>
            ) : null}
          </div>
        </form>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold">{c.reminders.title}</p>
          {reminders.length ? (
            <div className="mt-2 space-y-2">
              {reminders.slice(0, 6).map((reminder) => (
                <div
                  key={reminder.id}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-medium">
                        {labels[reminder.kind]}
                      </span>
                      {reminder.status === 'paused' ? (
                        <span className="ml-2 text-xs text-slate-500">
                          {c.reminders.paused}
                        </span>
                      ) : null}
                      <span className="block text-slate-600">
                        {reminder.schedule.time} ·{' '}
                        {reminder.schedule.days
                          .map((day) => dayLabels[day])
                          .join(', ')}
                      </span>
                      {reminder.schedule.quietHours ? (
                        <span className="block text-xs text-slate-500">
                          {c.reminders.quietHours}:{' '}
                          {reminder.schedule.quietHours.start}–
                          {reminder.schedule.quietHours.end}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-slate-500">
                        {c.reminders.next}:{' '}
                        {new Intl.DateTimeFormat(
                          locale === 'vi' ? 'vi-VN' : 'en-GB',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Bangkok',
                          },
                        ).format(new Date(reminder.nextDeliveryAt))}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => edit(reminder)}
                      >
                        {c.common.edit}
                      </Button>
                      {reminder.status === 'active' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void onAction(reminder, {
                              action: 'snooze',
                              minutes: 60,
                            })
                          }
                        >
                          {c.reminders.snoozeHour}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void onAction(reminder, {
                            action:
                              reminder.status === 'active' ? 'pause' : 'resume',
                          })
                        }
                      >
                        {reminder.status === 'active'
                          ? c.reminders.pause
                          : c.reminders.resume}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-rose-700"
                        onClick={() => {
                          if (window.confirm(c.reminders.deleteConfirm))
                            void onAction(reminder, { action: 'delete' });
                        }}
                      >
                        {c.reminders.delete}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {c.reminders.noReminders}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
