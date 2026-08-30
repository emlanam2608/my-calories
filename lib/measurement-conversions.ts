export const canonicalMeasurementUnits = {
  weight: 'kg',
  blood_pressure: 'mmHg',
  blood_glucose: 'mmol/L',
  total_cholesterol: 'mmol/L',
  uric_acid: 'µmol/L',
} as const;

export const measurementUnitOptions = {
  weight: ['kg', 'lb'],
  blood_pressure: ['mmHg'],
  blood_glucose: ['mmol/L', 'mg/dL'],
  total_cholesterol: ['mmol/L', 'mg/dL'],
  uric_acid: ['µmol/L', 'mg/dL'],
} as const;

export type ConvertibleMeasurementMetric = keyof typeof canonicalMeasurementUnits;

type MeasurementInput = {
  metric: ConvertibleMeasurementMetric;
  value: number;
  secondaryValue?: number;
  unit: string;
};

export function isSupportedMeasurementUnit(metric: ConvertibleMeasurementMetric, unit: string) {
  return (measurementUnitOptions[metric] as readonly string[]).includes(unit);
}

export function normalizeMeasurement(input: MeasurementInput) {
  const { metric, unit } = input;
  if (!isSupportedMeasurementUnit(metric, unit)) throw new Error('Unsupported measurement unit.');
  const value = convertValue(metric, input.value, unit);
  const secondaryValue = input.secondaryValue === undefined ? undefined : convertValue(metric, input.secondaryValue, unit);
  return { value, ...(secondaryValue === undefined ? {} : { secondaryValue }), unit: canonicalMeasurementUnits[metric] };
}

function convertValue(metric: ConvertibleMeasurementMetric, value: number, unit: string) {
  if (unit === canonicalMeasurementUnits[metric]) return value;
  if (metric === 'weight' && unit === 'lb') return value / 2.204_622_621_8;
  if (metric === 'blood_glucose' && unit === 'mg/dL') return value / 18.0182;
  if (metric === 'total_cholesterol' && unit === 'mg/dL') return value / 38.67;
  if (metric === 'uric_acid' && unit === 'mg/dL') return value * 59.48;
  throw new Error('Unsupported measurement unit.');
}
