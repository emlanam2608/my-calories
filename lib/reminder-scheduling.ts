export type ReminderSchedule = {
  timezone: 'Asia/Bangkok';
  time: string;
  days: Array<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'>;
  quietHours?: { start: string; end: string };
};

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Asia/Bangkok has no daylight-saving changes, so this keeps schedule math deterministic. */
export function nextReminderDelivery(schedule: ReminderSchedule, now = new Date()) {
  const [hours, minutes] = schedule.time.split(':').map(Number);
  const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidateBangkok = new Date(Date.UTC(
      bangkokNow.getUTCFullYear(),
      bangkokNow.getUTCMonth(),
      bangkokNow.getUTCDate() + offset,
      hours,
      minutes,
    ));
    const day = days[candidateBangkok.getUTCDay()];
    const candidate = new Date(candidateBangkok.getTime() - 7 * 60 * 60 * 1000);
    if (schedule.days.includes(day) && candidate > now) return deferForQuietHours(candidate, schedule);
  }
  throw new Error('Reminder schedule has no upcoming delivery.');
}

function minutesSinceMidnight(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Returns whether a Bangkok-local time is within an inclusive-start, exclusive-end quiet period. */
function isQuietMinute(minute: number, quietHours: NonNullable<ReminderSchedule['quietHours']>) {
  const start = minutesSinceMidnight(quietHours.start);
  const end = minutesSinceMidnight(quietHours.end);
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/** Defers a scheduled or snoozed reminder until the end of its Bangkok quiet period. */
export function deferForQuietHours(candidate: Date, schedule: ReminderSchedule) {
  if (!schedule.quietHours) return candidate;
  const bangkok = new Date(candidate.getTime() + 7 * 60 * 60 * 1000);
  const minute = bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes();
  if (!isQuietMinute(minute, schedule.quietHours)) return candidate;
  const [endHour, endMinute] = schedule.quietHours.end.split(':').map(Number);
  const quietStart = minutesSinceMidnight(schedule.quietHours.start);
  const quietEnd = minutesSinceMidnight(schedule.quietHours.end);
  const crossesMidnight = quietStart > quietEnd;
  const endsTomorrow = crossesMidnight && minute >= quietStart;
  const deferredBangkok = new Date(Date.UTC(
    bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate() + (endsTomorrow ? 1 : 0), endHour, endMinute,
  ));
  return new Date(deferredBangkok.getTime() - 7 * 60 * 60 * 1000);
}

export function snoozedReminderDelivery(schedule: ReminderSchedule, minutes: 15 | 30 | 60 | 180, now = new Date()) {
  return deferForQuietHours(new Date(now.getTime() + minutes * 60_000), schedule);
}
