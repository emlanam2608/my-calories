import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createMealReviewRequestSchema } from '@/lib/contracts';
import { issueMealAnalysisReview } from '@/lib/meal-analysis-review-server';
import { consumeRequestQuota } from '@/lib/request-quota';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const quota = consumeRequestQuota('meal_review', user.userId, {
    limit: 60,
    windowMs: 60 * 60 * 1_000,
  });
  if (!quota.allowed)
    return Response.json(
      { error: 'Meal review is temporarily limited. Please try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(quota.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      },
    );
  const parsed = createMealReviewRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Review the meal facts before requesting confirmation.' },
      { status: 400 },
    );
  let analysis;
  try {
    analysis = await issueMealAnalysisReview(user.userId, parsed.data.analysis);
  } catch {
    return Response.json(
      { error: 'The private server review could not be created. No meal was saved; please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json(
    { analysis },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
