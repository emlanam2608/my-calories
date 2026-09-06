import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createMealRequestSchema, healthFindingSchema, nutritionSnapshotSchema, reviewedMealAnalysisSchema } from '@/lib/contracts';
import { getDb } from '@/db';
import { mealAnalysisReviews, mealEntries, requestDeduplications } from '@/db/schema';
import { resolveMealReviewContext } from '@/lib/meal-analysis-review-server';

function dayBounds(value: string | null) {
  const day = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const { start, end } = dayBounds(new URL(request.url).searchParams.get('date'));
  const rows = await getDb().select().from(mealEntries).where(and(eq(mealEntries.ownerId, user.userId), gte(mealEntries.occurredAt, start), lt(mealEntries.occurredAt, end))).orderBy(desc(mealEntries.occurredAt));
  const meals = rows.flatMap((row) => {
    const snapshot = nutritionSnapshotSchema.safeParse(row.nutritionSnapshot);
    const findings = healthFindingSchema.array().max(16).safeParse(row.healthFindings);
    return snapshot.success && findings.success
      ? [{ ...row, nutritionSnapshot: snapshot.data, healthFindings: findings.data }]
      : [];
  });
  return Response.json({ meals }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = createMealRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'The meal could not be validated. Review every required field.' }, { status: 400 });

  const db = getDb();
  const existing = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
  if (existing[0]) {
    if (existing[0].resourceType !== 'meal') return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    return Response.json({ id: existing[0].resourceId, replayed: true });
  }

  const reviewRows = await db.select().from(mealAnalysisReviews).where(and(
    eq(mealAnalysisReviews.id, parsed.data.reviewId),
    eq(mealAnalysisReviews.ownerId, user.userId),
  )).limit(1);
  const review = reviewRows[0];
  if (!review)
    return Response.json({ error: 'The server meal review was not found.' }, { status: 404 });
  if (review.consumedAt)
    return Response.json({ error: 'This server meal review has already been confirmed.' }, { status: 409 });
  const now = new Date();
  if (review.expiresAt.getTime() <= now.getTime())
    return Response.json({ error: 'This server meal review expired. Review the meal again before saving.' }, { status: 410 });
  const reviewedAnalysis = reviewedMealAnalysisSchema.safeParse(review.analysis);
  if (!reviewedAnalysis.success)
    return Response.json({ error: 'The server meal review is invalid. Review the meal again before saving.' }, { status: 409 });
  let currentContext;
  try {
    currentContext = await resolveMealReviewContext(user.userId);
  } catch {
    return Response.json(
      { error: 'The server could not revalidate this meal review. No meal was saved; please try again.' },
      { status: 503 },
    );
  }
  if (currentContext.fingerprint !== review.contextFingerprint)
    return Response.json({ error: 'Your health focuses or targets changed. Review the meal again before saving.' }, { status: 409 });

  const id = crypto.randomUUID();
  const analysis = reviewedAnalysis.data;
  try {
    await db.batch([
      db.insert(mealEntries).values({
        id,
        ownerId: user.userId,
        occurredAt: new Date(parsed.data.occurredAt),
        mealType: analysis.mealType,
        name: analysis.name,
        nutritionSnapshot: analysis.snapshot,
        healthFindings: analysis.healthFindings,
        analysisSource: analysis.snapshot.source,
        confidence: analysis.confidence,
        reviewId: review.id,
        createdAt: now,
      }),
      db.update(mealAnalysisReviews).set({ consumedAt: now }).where(and(
        eq(mealAnalysisReviews.id, review.id),
        eq(mealAnalysisReviews.ownerId, user.userId),
        isNull(mealAnalysisReviews.consumedAt),
      )),
      db.insert(requestDeduplications).values({ id: crypto.randomUUID(), ownerId: user.userId, idempotencyKey: parsed.data.idempotencyKey, resourceType: 'meal', resourceId: id, createdAt: now }),
    ]);
  } catch {
    const replay = await db.select({ resourceId: requestDeduplications.resourceId, resourceType: requestDeduplications.resourceType }).from(requestDeduplications).where(and(eq(requestDeduplications.ownerId, user.userId), eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey))).limit(1);
    if (replay[0]?.resourceType === 'meal') return Response.json({ id: replay[0].resourceId, replayed: true });
    if (replay[0]) return Response.json({ error: 'This idempotency key has already been used for a different request.' }, { status: 409 });
    const confirmedReview = await db.select({ id: mealEntries.id }).from(mealEntries)
      .where(and(eq(mealEntries.ownerId, user.userId), eq(mealEntries.reviewId, review.id))).limit(1);
    if (confirmedReview[0])
      return Response.json({ error: 'This server meal review has already been confirmed.' }, { status: 409 });
    return Response.json({ error: 'We could not save this meal. Please try again.' }, { status: 500 });
  }
  return Response.json({ id, replayed: false }, { status: 201 });
}
