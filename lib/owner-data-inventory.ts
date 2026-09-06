export const ownerDataInventory = [
  'profile',
  'healthTargets',
  'onboarding',
  'sensitiveNotes',
  'uploads',
  'aiExecutions',
  'savedFoods',
  'healthFocuses',
  'mealAnalysisReviews',
  'meals',
  'measurements',
  'workoutSessions',
  'workoutReadiness',
  'workoutPlans',
  'workoutCheckins',
  'reminders',
  'requestDeduplications',
] as const;

export type OwnerDataKey = (typeof ownerDataInventory)[number];

/**
 * Request idempotency rows are operational safety metadata, not a useful part
 * of a person's portable health record. They remain in the deletion inventory
 * but are deliberately excluded from the public archive contract.
 */
export const publicArchiveOwnerDataInventory = [
  'profile',
  'healthTargets',
  'onboarding',
  'sensitiveNotes',
  'uploads',
  'aiExecutions',
  'savedFoods',
  'healthFocuses',
  'meals',
  'measurements',
  'workoutSessions',
  'workoutReadiness',
  'workoutPlans',
  'workoutCheckins',
  'reminders',
] as const satisfies readonly OwnerDataKey[];

export function assertOwnerDataInventory(keys: readonly string[]) {
  assertInventory(keys, ownerDataInventory, 'Owner data');
}

export function assertPublicArchiveOwnerDataInventory(keys: readonly string[]) {
  assertInventory(keys, publicArchiveOwnerDataInventory, 'Public archive');
}

function assertInventory(keys: readonly string[], inventory: readonly string[], label: string) {
  const received = new Set(keys);
  const missing = inventory.filter((key) => !received.has(key));
  const unexpected = keys.filter((key) => !inventory.includes(key));
  if (missing.length || unexpected.length)
    throw new Error(`${label} inventory mismatch. Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}.`);
}
