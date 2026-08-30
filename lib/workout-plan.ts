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

export type WorkoutPlanPreferences = {
  equipment: string[];
  clinicianRestrictionFlags: string[];
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

export function selectableWorkoutExercises(
  catalog: ExerciseCatalogEntry[],
  preferences: WorkoutPlanPreferences,
) {
  const equipmentLabels = new Set(
    preferences.equipment.flatMap((item) =>
      item === 'exercise_mat'
        ? ['exercise mat']
        : item === 'mini_treadmill'
          ? ['mini treadmill']
          : item === 'resistance_band'
            ? ['resistance band']
            : item === 'bodyweight'
              ? ['wall']
              : item === 'gym'
                ? ['exercise mat', 'chair', 'wall', 'bicycle', 'mini treadmill', 'resistance band']
                : [item],
    ),
  );
  return catalog.filter((exercise) => {
    const hasEquipment = exercise.equipment.every((item) => equipmentLabels.has(item));
    const avoidsResistance = preferences.clinicianRestrictionFlags.includes('avoid_resistance');
    return hasEquipment && !(avoidsResistance && exercise.category === 'strength');
  });
}

function firstAvailable(catalog: ExerciseCatalogEntry[], ids: string[]) {
  const available = new Set(catalog.map((exercise) => exercise.id));
  const id = ids.find((candidate) => available.has(candidate));
  if (!id)
    throw new Error('Your selected equipment cannot support this starter plan yet. Update equipment or use a clinician-approved alternative.');
  return id;
}

export function createStarterWorkoutPlan(
  catalog: ExerciseCatalogEntry[],
  periodStart: string,
  preferences: WorkoutPlanPreferences = {
    equipment: ['exercise_mat', 'chair', 'bodyweight', 'bicycle', 'mini_treadmill', 'resistance_band'],
    clinicianRestrictionFlags: [],
  },
): WorkoutPlanDraft {
  const selectedCatalog = selectableWorkoutExercises(catalog, preferences);
  const mobility = firstAvailable(selectedCatalog, ['cat-cow']);
  const aerobic = firstAvailable(selectedCatalog, ['treadmill-walk', 'bicycle-easy']);
  const strength = preferences.clinicianRestrictionFlags.includes('avoid_resistance')
    ? null
    : firstAvailable(selectedCatalog, ['sit-to-stand', 'wall-push-up', 'band-row']);
  const note = preferences.clinicianRestrictionFlags.includes('monitor_glucose')
    ? {
        en: 'Follow your clinician’s glucose-monitoring instructions. Stop for concerning symptoms and do not progress before a scheduled check-in.',
        vi: 'Tuân theo hướng dẫn theo dõi đường huyết của bác sĩ. Dừng lại khi có triệu chứng đáng lo và không tăng tiến trước lần đánh giá định kỳ.',
      }
    : safetyNote;
  const strengthSessions = strength
    ? [
        {
          id: 'starter-strength-a',
          dayOffset: 0,
          title: { en: 'Strength and mobility', vi: 'Sức mạnh và linh hoạt' },
          durationMinutes: 22,
          rpe: 3,
          rationale: {
            en: 'A low-intensity full-body foundation using only your selected, home-friendly equipment.',
            vi: 'Nền tảng toàn thân cường độ thấp chỉ dùng thiết bị tại nhà bạn đã chọn.',
          },
          exerciseIds: requireExercises(selectedCatalog, [mobility, strength]),
          safetyNote: note,
        },
        {
          id: 'starter-strength-b',
          dayOffset: 4,
          title: { en: 'Strength and posture', vi: 'Sức mạnh và tư thế' },
          durationMinutes: 22,
          rpe: 3,
          rationale: {
            en: 'A second short session using the same safe equipment and an easy effort.',
            vi: 'Buổi ngắn thứ hai sử dụng cùng thiết bị an toàn và mức gắng sức nhẹ.',
          },
          exerciseIds: requireExercises(selectedCatalog, [mobility, strength]),
          safetyNote: note,
        },
      ]
    : [
        {
          id: 'starter-mobility-a',
          dayOffset: 0,
          title: { en: 'Mobility and easy movement', vi: 'Linh hoạt và vận động nhẹ' },
          durationMinutes: 18,
          rpe: 2,
          rationale: {
            en: 'Strength work is excluded by the recorded clinician restriction.',
            vi: 'Bài tập sức mạnh được loại trừ theo hạn chế do bác sĩ chỉ định.',
          },
          exerciseIds: requireExercises(selectedCatalog, [mobility]),
          safetyNote: note,
        },
        {
          id: 'starter-mobility-b',
          dayOffset: 4,
          title: { en: 'Easy movement', vi: 'Vận động nhẹ' },
          durationMinutes: 18,
          rpe: 2,
          rationale: {
            en: 'A conservative alternative that keeps strength work excluded.',
            vi: 'Một lựa chọn thận trọng tiếp tục loại trừ bài tập sức mạnh.',
          },
          exerciseIds: requireExercises(selectedCatalog, [mobility]),
          safetyNote: note,
        },
      ];
  const aerobicSession: WorkoutPlanSession = {
    id: 'starter-aerobic',
    dayOffset: 2,
    title: { en: 'Easy aerobic movement', vi: 'Vận động aerobic nhẹ' },
    durationMinutes: 20,
    rpe: 3,
    rationale: {
      en: 'Comfortable aerobic work at a pace that still allows full sentences.',
      vi: 'Vận động aerobic thoải mái ở mức vẫn có thể nói trọn câu.',
    },
    exerciseIds: requireExercises(selectedCatalog, [aerobic]),
    safetyNote: note,
  };
  return {
    planVersion: 'starter-plan-1',
    periodStart,
    sessions: [strengthSessions[0], aerobicSession, strengthSessions[1]],
  };
}
