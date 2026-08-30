import type { ExerciseCatalogEntry } from './exercise-catalog';

export type WorkoutPlanSession = {
  id: string;
  dayOffset: number;
  title: { en: string; vi: string };
  durationMinutes: number;
  rpe: number;
  rationale: { en: string; vi: string };
  exerciseIds: string[];
  safetyNote: { en: string; vi: string };
};

export type WorkoutPlanDraft = {
  planVersion: 'starter-plan-1';
  periodStart: string;
  sessions: WorkoutPlanSession[];
};

const safetyNote = {
  en: 'Stop if you develop concerning symptoms. Do not progress this plan without a scheduled check-in.',
  vi: 'Dừng lại nếu xuất hiện triệu chứng đáng lo. Không tăng tiến kế hoạch này nếu chưa có lần đánh giá định kỳ.',
};

function requireExercises(catalog: ExerciseCatalogEntry[], ids: string[]) {
  const available = new Set(catalog.map((exercise) => exercise.id));
  if (!ids.every((id) => available.has(id)))
    throw new Error('The starter exercise catalog is incomplete. Please try again later.');
  return ids;
}

export function createStarterWorkoutPlan(
  catalog: ExerciseCatalogEntry[],
  periodStart: string,
): WorkoutPlanDraft {
  return {
    planVersion: 'starter-plan-1',
    periodStart,
    sessions: [
      {
        id: 'starter-strength-a',
        dayOffset: 0,
        title: { en: 'Strength and mobility', vi: 'Sức mạnh và linh hoạt' },
        durationMinutes: 22,
        rpe: 3,
        rationale: {
          en: 'A low-intensity full-body foundation using stable, home-friendly movements.',
          vi: 'Nền tảng toàn thân cường độ thấp với các động tác ổn định, phù hợp tại nhà.',
        },
        exerciseIds: requireExercises(catalog, ['cat-cow', 'sit-to-stand', 'wall-push-up']),
        safetyNote,
      },
      {
        id: 'starter-aerobic',
        dayOffset: 2,
        title: { en: 'Easy aerobic movement', vi: 'Vận động aerobic nhẹ' },
        durationMinutes: 20,
        rpe: 3,
        rationale: {
          en: 'Comfortable aerobic work at a pace that still allows full sentences.',
          vi: 'Vận động aerobic thoải mái ở mức vẫn có thể nói trọn câu.',
        },
        exerciseIds: requireExercises(catalog, ['treadmill-walk', 'bicycle-easy']),
        safetyNote,
      },
      {
        id: 'starter-strength-b',
        dayOffset: 4,
        title: { en: 'Strength and posture', vi: 'Sức mạnh và tư thế' },
        durationMinutes: 22,
        rpe: 3,
        rationale: {
          en: 'A second short full-body session with pulling and posture-focused work.',
          vi: 'Buổi toàn thân ngắn thứ hai, tập trung kéo và tư thế.',
        },
        exerciseIds: requireExercises(catalog, ['cat-cow', 'sit-to-stand', 'band-row']),
        safetyNote,
      },
    ],
  };
}
