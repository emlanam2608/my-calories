import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { foodLookupCache } from '@/db/schema';
import { foodAnalysisSchema, type FoodAnalysis } from './contracts';

const ttlMs = 1000 * 60 * 60 * 24 * 7;

export async function resolveCachedFoodAnalysis(provider: string, input: string, resolve: () => Promise<FoodAnalysis>) {
  const cacheKey = await hashedKey(`${provider}:${input.trim().toLocaleLowerCase('vi-VN')}`);
  const cached = await read(cacheKey).catch(() => null);
  if (cached) return cached;

  const analysis = await resolve();
  await write(cacheKey, provider, analysis).catch(() => undefined);
  return analysis;
}

async function read(cacheKey: string) {
  const row = await getDb().select({ analysis: foodLookupCache.analysis }).from(foodLookupCache).where(and(eq(foodLookupCache.cacheKey, cacheKey), gt(foodLookupCache.expiresAt, new Date()))).limit(1);
  if (!row[0]) return null;
  const parsed = foodAnalysisSchema.safeParse(row[0].analysis);
  return parsed.success ? parsed.data : null;
}

async function write(cacheKey: string, provider: string, analysis: FoodAnalysis) {
  const now = new Date();
  await getDb().insert(foodLookupCache).values({ cacheKey, provider, analysis, expiresAt: new Date(now.getTime() + ttlMs), updatedAt: now }).onConflictDoUpdate({ target: foodLookupCache.cacheKey, set: { provider, analysis, expiresAt: new Date(now.getTime() + ttlMs), updatedAt: now } });
}

async function hashedKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
