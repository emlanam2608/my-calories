import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { aiExecutions, uploads } from '@/db/schema';
import {
  extractFoodRequestSchema,
  foodExtractionResponseSchema,
} from '@/lib/contracts';
import {
  extractFoodFromImage,
  FOOD_EXTRACTION_PROMPT_VERSION,
  FOOD_EXTRACTION_SCHEMA_VERSION,
  OpenAIExtractionError,
} from '@/lib/openai-food-extraction';
import { consumeRequestQuota } from '@/lib/request-quota';
import { cleanExpiredPrivateUploads } from '@/lib/upload-expiry-cleanup';

const feature = 'food_image_extraction';
const fallbackModel = 'gpt-5.6-luna';

async function recordExecution(input: {
  ownerId: string;
  uploadId: string;
  model: string;
  status: 'succeeded' | 'failed';
  latencyMs: number;
  failureCode: string | null;
}) {
  await getDb().insert(aiExecutions).values({
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    uploadId: input.uploadId,
    feature,
    model: input.model,
    promptVersion: FOOD_EXTRACTION_PROMPT_VERSION,
    schemaVersion: FOOD_EXTRACTION_SCHEMA_VERSION,
    status: input.status,
    latencyMs: input.latencyMs,
    failureCode: input.failureCode,
    createdAt: new Date(),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);

  const quota = consumeRequestQuota(feature, user.userId, {
    limit: 10,
    windowMs: 60 * 60 * 1_000,
  });
  if (!quota.allowed) {
    return Response.json(
      { error: 'Image extraction is temporarily limited. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds), 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = extractFoodRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid private meal or label image.' }, { status: 400 });

  const upload = (
    await getDb()
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, parsed.data.uploadId), eq(uploads.ownerId, user.userId)))
      .limit(1)
  )[0];
  if (!upload || upload.status !== 'pending' || upload.expiresAt <= new Date() || (upload.kind !== 'meal_photo' && upload.kind !== 'nutrition_label')) {
    return Response.json({ error: 'That private image is unavailable for extraction.' }, { status: 404 });
  }

  const model = env.OPENAI_EXTRACTION_MODEL || fallbackModel;
  const startedAt = Date.now();
  if (!env.OPENAI_API_KEY) {
    await recordExecution({ ownerId: user.userId, uploadId: upload.id, model, status: 'failed', latencyMs: 0, failureCode: 'unavailable' });
    return Response.json(
      { error: 'AI image extraction is not configured. You can still use text, barcode, provider search, or manual entry.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const object = await env.FILES.get(upload.storageKey);
  if (!object) return Response.json({ error: 'That private image is unavailable for extraction.' }, { status: 404 });

  try {
    const proposal = await extractFoodFromImage({
      apiKey: env.OPENAI_API_KEY,
      model,
      image: {
        bytes: new Uint8Array(await object.arrayBuffer()),
        contentType: upload.contentType as 'image/jpeg' | 'image/png' | 'image/webp',
        kind: upload.kind as 'meal_photo' | 'nutrition_label',
      },
    });
    await recordExecution({ ownerId: user.userId, uploadId: upload.id, model, status: 'succeeded', latencyMs: Date.now() - startedAt, failureCode: null });
    return Response.json(
      foodExtractionResponseSchema.parse({ proposal, model, promptVersion: FOOD_EXTRACTION_PROMPT_VERSION, schemaVersion: FOOD_EXTRACTION_SCHEMA_VERSION }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const code = error instanceof OpenAIExtractionError ? error.code : 'provider_failed';
    await recordExecution({ ownerId: user.userId, uploadId: upload.id, model, status: 'failed', latencyMs: Date.now() - startedAt, failureCode: code });
    return Response.json(
      { error: 'We could not extract that image. Please review it manually or try another capture.', manualReviewRequired: true },
      { status: code === 'timed_out' || code === 'provider_failed' ? 503 : 422, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
