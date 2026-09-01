import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { aiExecutions, uploads } from '@/db/schema';
import { extractMeasurementRequestSchema, measurementExtractionResponseSchema } from '@/lib/contracts';
import { MEASUREMENT_EXTRACTION_PROMPT_VERSION, MEASUREMENT_EXTRACTION_SCHEMA_VERSION, extractMeasurementsFromImage } from '@/lib/openai-measurement-extraction';
import { OpenAIExtractionError } from '@/lib/openai-food-extraction';
import { consumeRequestQuota } from '@/lib/request-quota';
import { cleanExpiredPrivateUploads } from '@/lib/upload-expiry-cleanup';

const modelDefault = 'gpt-5.6-luna';
const feature = 'measurement_report_extraction';

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);
  const parsed = extractMeasurementRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Choose a valid private report image.' }, { status: 400 });
  const upload = (await getDb().select().from(uploads).where(and(eq(uploads.id, parsed.data.uploadId), eq(uploads.ownerId, user.userId))).limit(1))[0];
  if (!upload || upload.kind !== 'measurement_report' || upload.status !== 'pending' || upload.expiresAt <= new Date()) return Response.json({ error: 'That report image is unavailable.' }, { status: 404 });
  const quota = consumeRequestQuota(feature, user.userId, { limit: 10, windowMs: 3_600_000 });
  if (!quota.allowed) {
    return Response.json(
      { error: 'Report extraction is temporarily limited. Please try again shortly.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(quota.retryAfterSeconds) } },
    );
  }
  const model = env.OPENAI_EXTRACTION_MODEL || modelDefault;
  const started = Date.now();
  const record = async (status: 'succeeded' | 'failed', failureCode: string | null) => getDb().insert(aiExecutions).values({ id: crypto.randomUUID(), ownerId: user.userId, uploadId: upload.id, feature, model, promptVersion: MEASUREMENT_EXTRACTION_PROMPT_VERSION, schemaVersion: MEASUREMENT_EXTRACTION_SCHEMA_VERSION, status, latencyMs: Date.now() - started, failureCode, createdAt: new Date() });
  if (!env.OPENAI_API_KEY) {
    await record('failed', 'unavailable');
    return Response.json({ error: 'AI report extraction is not configured. You can enter measurements manually.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const object = await env.FILES.get(upload.storageKey);
  if (!object) return Response.json({ error: 'That report image is unavailable.' }, { status: 404 });
  try {
    const proposal = await extractMeasurementsFromImage({ apiKey: env.OPENAI_API_KEY, model, bytes: new Uint8Array(await object.arrayBuffer()), contentType: upload.contentType as 'image/jpeg' | 'image/png' | 'image/webp' });
    await record('succeeded', null);
    return Response.json(measurementExtractionResponseSchema.parse({ proposal, model, promptVersion: MEASUREMENT_EXTRACTION_PROMPT_VERSION, schemaVersion: MEASUREMENT_EXTRACTION_SCHEMA_VERSION }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof OpenAIExtractionError ? error.code : 'provider_failed';
    await record('failed', code);
    const status = code === 'timed_out' || code === 'provider_failed' ? 503 : 422;
    return Response.json({ error: 'We could not extract that report. Please enter each value manually.', manualReviewRequired: true }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
