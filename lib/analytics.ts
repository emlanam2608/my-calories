export type AnalyticsMeal = {
  occurredAt: Date;
  calories: number;
  protein: number;
  fiber: number;
  sodium: number;
};

export type AnalyticsMeasurement = {
  metric: string;
  value: number;
  unit: string;
  occurredAt: Date;
};

export type AnalyticsWorkout = {
  status: 'completed' | 'stopped_for_safety';
  durationMinutes: number;
  completedAt: Date;
};

function bangkokDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function buildAnalytics({
  periodDays,
  meals,
  measurements,
  workouts,
}: {
  periodDays: number;
  meals: AnalyticsMeal[];
  measurements: AnalyticsMeasurement[];
  workouts: AnalyticsWorkout[];
}) {
  const daily = new Map<string, { date: string; calories: number; protein: number; fiber: number; sodium: number; mealCount: number }>();
  for (const meal of meals) {
    const date = bangkokDay(meal.occurredAt);
    const value = daily.get(date) ?? { date, calories: 0, protein: 0, fiber: 0, sodium: 0, mealCount: 0 };
    value.calories += meal.calories;
    value.protein += meal.protein;
    value.fiber += meal.fiber;
    value.sodium += meal.sodium;
    value.mealCount += 1;
    daily.set(date, value);
  }

  const measurementGroups = new Map<string, AnalyticsMeasurement[]>();
  for (const measurement of measurements) {
    const values = measurementGroups.get(measurement.metric) ?? [];
    values.push(measurement);
    measurementGroups.set(measurement.metric, values);
  }
  const measurementTrends = [...measurementGroups.entries()].map(([metric, values]) => {
    const ordered = [...values].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    return {
      metric,
      unit: last.unit,
      sampleSize: ordered.length,
      firstValue: first.value,
      lastValue: last.value,
      change: last.value - first.value,
    };
  });

  const observedDays = new Set([
    ...meals.map((meal) => bangkokDay(meal.occurredAt)),
    ...measurements.map((measurement) => bangkokDay(measurement.occurredAt)),
    ...workouts.map((workout) => bangkokDay(workout.completedAt)),
  ]);
  const completed = workouts.filter((workout) => workout.status === 'completed');
  const stoppedForSafety = workouts.filter((workout) => workout.status === 'stopped_for_safety');
  return {
    periodDays,
    dailyNutrition: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)).map((day) => ({
      ...day,
      calories: Math.round(day.calories),
      protein: Math.round(day.protein * 10) / 10,
      fiber: Math.round(day.fiber * 10) / 10,
      sodium: Math.round(day.sodium),
    })),
    measurementTrends,
    workout: {
      completedSessions: completed.length,
      stoppedForSafety: stoppedForSafety.length,
      totalMinutes: completed.reduce((total, workout) => total + workout.durationMinutes, 0),
    },
    completeness: {
      observedDays: observedDays.size,
      coveragePercent: Math.round((observedDays.size / periodDays) * 100),
    },
  };
}
