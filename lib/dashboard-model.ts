import type { FoodAnalysis, MealCreateRequest } from './contracts';

export const dashboardTargets = [
  { key: 'calories', label: 'Calories', target: 1850, unit: 'kcal', color: 'bg-orange-400' },
  { key: 'protein', label: 'Protein', target: 90, unit: 'g', color: 'bg-violet-500' },
  { key: 'fiber', label: 'Fiber', target: 28, unit: 'g', color: 'bg-emerald-500' },
  { key: 'sodium', label: 'Sodium', target: 2000, unit: 'mg', color: 'bg-rose-500' },
] as const;

export type DashboardTargetKey = (typeof dashboardTargets)[number]['key'];

export type DashboardMeal = {
  id: string;
  name: string;
  mealType: MealCreateRequest['mealType'];
  occurredAt: string;
  confidence: number;
  nutritionSnapshot: FoodAnalysis['snapshot'];
};

export const measurementOptions = [
  { metric: 'weight', unit: 'kg', step: '0.1' },
  { metric: 'blood_pressure', unit: 'mmHg', step: '1' },
  { metric: 'blood_glucose', unit: 'mmol/L', step: '0.1' },
  { metric: 'total_cholesterol', unit: 'mmol/L', step: '0.1' },
  { metric: 'uric_acid', unit: 'µmol/L', step: '1' },
  { metric: 'custom_lab', unit: '', step: '0.01' },
] as const;

export type MeasurementMetric = (typeof measurementOptions)[number]['metric'];
export type ConvertibleMeasurementMetric = Exclude<MeasurementMetric, 'custom_lab'>;

export const workoutReadinessFlags = ['chestPain', 'faintingOrDizziness', 'severeShortnessOfBreath', 'irregularHeartbeat', 'clinicianRestriction', 'exerciseGlucoseRisk'] as const;
export type WorkoutReadinessFlag = (typeof workoutReadinessFlags)[number];
