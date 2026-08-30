import { describe, expect, it } from 'vitest';
import { parseExerciseCatalogRow } from './exercise-catalog';

describe('exercise catalog contract', () => {
  it('requires bilingual technique and safe substitution fields', () => {
    expect(() =>
      parseExerciseCatalogRow({
        id: 'wall-push-up',
        name: { en: 'Wall push-up', vi: 'Chống đẩy tường' },
        category: 'strength',
        equipment: ['wall'],
        muscleGroups: ['chest'],
        contraindicationTags: ['wrist_pain'],
        technique: { en: 'Keep a long spine.', vi: 'Giữ cột sống thẳng.' },
        regression: { en: 'Stand closer.', vi: 'Đứng gần tường hơn.' },
        progression: { en: 'Lower the hand position.', vi: 'Hạ vị trí tay xuống.' },
        substitutionIds: ['sit-to-stand'],
      }),
    ).not.toThrow();
  });
});
