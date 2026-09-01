import type { FoodAnalysis } from './contracts';

type AdditionalNutrients = FoodAnalysis['snapshot']['additionalNutrients'];
type NutrientKey = keyof NonNullable<AdditionalNutrients>;

export type AvailableNutrient = {
  state: 'available';
  key: NutrientKey;
  value: number;
  unit: string;
  sourceState: 'reported' | 'estimated';
};

export type NutrientAvailability = AvailableNutrient | {
  state: 'unavailable' | 'unsupported_unit';
  key: NutrientKey;
  unit: string | null;
};

/** Keeps absent, explicitly unavailable, reported zero, and unsupported units distinct. */
export function readNutrient(
  nutrients: AdditionalNutrients,
  key: NutrientKey,
  supportedUnits?: readonly string[],
): NutrientAvailability {
  const nutrient = nutrients?.[key];
  if (!nutrient || nutrient.state === 'unavailable' || nutrient.value === null)
    return { state: 'unavailable', key, unit: nutrient?.unit ?? null };
  if (supportedUnits && !supportedUnits.includes(nutrient.unit))
    return { state: 'unsupported_unit', key, unit: nutrient.unit };
  return {
    state: 'available',
    key,
    value: nutrient.value,
    unit: nutrient.unit,
    sourceState: nutrient.state,
  };
}
