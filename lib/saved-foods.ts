import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { savedFoods } from '@/db/schema';
import { nutritionSnapshotSchema, type FoodAnalysis } from './contracts';
import { normalizePersonalFoodName } from './saved-food-normalization';

export { normalizePersonalFoodName } from './saved-food-normalization';

export async function resolvePersonalFood(ownerId: string, name: string): Promise<FoodAnalysis | null> {
  const normalizedName = normalizePersonalFoodName(name);
  const row = (
    await getDb()
      .select()
      .from(savedFoods)
      .where(and(eq(savedFoods.ownerId, ownerId), eq(savedFoods.normalizedName, normalizedName)))
      .limit(1)
  )[0];
  if (!row) return null;
  const snapshot = nutritionSnapshotSchema.safeParse(row.nutritionSnapshot);
  if (!snapshot.success) return null;
  const hour = new Date().getHours();
  return {
    name: row.name,
    nameVi: row.nameVi,
    mealType: hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack',
    confidence: 100,
    unresolvedQuestions: [],
    snapshot: {
      ...snapshot.data,
      source: 'manual_entry',
      sourceVersion: 'personal-food-v1',
      sourceReference: `personal-food:${row.id}`,
      estimationLevel: 'user_confirmed',
    },
    finding: {
      code: 'personal-food-match',
      severity: 'info',
      text: `Using your previously confirmed ${row.kind}. You can still edit it before saving this meal.`,
    },
  };
}
