import { and, desc, eq, gte } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { measurements, requestDeduplications, uploads } from '@/db/schema';
import {
  measurementCreateRequestSchema,
  measurementsResponseSchema,
} from '@/lib/contracts';
import { normalizeMeasurement } from '@/lib/measurement-conversions';

const VALUE_SCALE = 100;

function serializeMeasurement(row: typeof measurements.$inferSelect) {
  return {
    id: row.id,
    metric: row.metric,
    label: row.label,
    value: row.valueScaled / row.valueScale,
    secondaryValue:
      row.secondaryValueScaled === null
        ? null
        : row.secondaryValueScaled / row.valueScale,
    unit: row.unit,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    confirmationStatus: row.confirmationStatus,
    provenance: row.provenance,
    sourceUploadId: row.sourceUploadId,
    sourceImageRetained: row.sourceUploadId !== null,
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const days = Math.min(
    365,
    Math.max(
      1,
      Number(new URL(request.url).searchParams.get('days') ?? 90) || 90,
    ),
  );
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await getDb()
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.ownerId, user.userId),
        gte(measurements.occurredAt, since),
      ),
    )
    .orderBy(desc(measurements.occurredAt));
  return Response.json(
    measurementsResponseSchema.parse({
      measurements: rows.map(serializeMeasurement),
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  const parsed = measurementCreateRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: 'Review the measurement, unit, and date before saving.' },
      { status: 400 },
    );

  const normalized = parsed.data.metric === 'custom_lab'
    ? { value: parsed.data.value, secondaryValue: parsed.data.secondaryValue, unit: parsed.data.unit }
    : normalizeMeasurement({ metric: parsed.data.metric, value: parsed.data.value, ...(parsed.data.secondaryValue === undefined ? {} : { secondaryValue: parsed.data.secondaryValue }), unit: parsed.data.unit });

  const db = getDb();
  const sourceUpload = parsed.data.sourceUploadId
    ? (await db.select().from(uploads).where(and(eq(uploads.id, parsed.data.sourceUploadId), eq(uploads.ownerId, user.userId))).limit(1))[0]
    : null;
  if (parsed.data.source === 'report_photo' && (!sourceUpload || sourceUpload.kind !== 'measurement_report' || sourceUpload.status !== 'pending' || sourceUpload.expiresAt <= new Date()))
    return Response.json({ error: 'That private report image is unavailable. Extract it again before confirming this value.' }, { status: 400 });
  const replay = await db
    .select({
      resourceId: requestDeduplications.resourceId,
      resourceType: requestDeduplications.resourceType,
    })
    .from(requestDeduplications)
    .where(
      and(
        eq(requestDeduplications.ownerId, user.userId),
        eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (replay[0]) {
    if (replay[0].resourceType !== 'measurement')
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json({ id: replay[0].resourceId, replayed: true });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.batch([
      db
        .insert(measurements)
        .values({
          id,
          ownerId: user.userId,
          metric: parsed.data.metric,
          label: parsed.data.label ?? null,
          valueScaled: Math.round(normalized.value * VALUE_SCALE),
          secondaryValueScaled:
            normalized.secondaryValue === undefined
              ? null
              : Math.round(normalized.secondaryValue * VALUE_SCALE),
          valueScale: VALUE_SCALE,
          unit: normalized.unit,
          source: parsed.data.source,
          confirmationStatus: 'confirmed',
          provenance: parsed.data.source === 'report_photo'
            ? parsed.data.retainSourceImage
              ? 'user_confirmed_report_image_retained'
              : 'user_confirmed_report'
            : 'user_entered',
          sourceUploadId: parsed.data.retainSourceImage ? sourceUpload?.id ?? null : null,
          occurredAt: new Date(parsed.data.occurredAt),
          createdAt: now,
        }),
      db
        .insert(requestDeduplications)
        .values({
          id: crypto.randomUUID(),
          ownerId: user.userId,
          idempotencyKey: parsed.data.idempotencyKey,
          resourceType: 'measurement',
          resourceId: id,
          createdAt: now,
        }),
    ]);
  } catch {
    const duplicate = await db
      .select({
        resourceId: requestDeduplications.resourceId,
        resourceType: requestDeduplications.resourceType,
      })
      .from(requestDeduplications)
      .where(
        and(
          eq(requestDeduplications.ownerId, user.userId),
          eq(requestDeduplications.idempotencyKey, parsed.data.idempotencyKey),
        ),
      )
      .limit(1);
    if (duplicate[0]?.resourceType === 'measurement')
      return Response.json({ id: duplicate[0].resourceId, replayed: true });
    if (duplicate[0])
      return Response.json(
        {
          error:
            'This idempotency key has already been used for a different request.',
        },
        { status: 409 },
      );
    return Response.json(
      { error: 'We could not save this measurement. Please try again.' },
      { status: 500 },
    );
  }
  if (sourceUpload) {
    if (parsed.data.retainSourceImage) {
      await db.update(uploads).set({
        status: 'retained',
        expiresAt: new Date(Date.now() + 10 * 365 * 86_400_000),
      }).where(and(eq(uploads.id, sourceUpload.id), eq(uploads.ownerId, user.userId), eq(uploads.status, 'pending')));
    } else {
      try {
        await env.FILES.delete(sourceUpload.storageKey);
        await db.update(uploads).set({ status: 'deleted', deletedAt: new Date() }).where(and(eq(uploads.id, sourceUpload.id), eq(uploads.ownerId, user.userId), eq(uploads.status, 'pending')));
      } catch {
        // The upload remains pending and expires soon; the confirmed structured value is never rolled back.
      }
    }
  }
  return Response.json({ id, replayed: false }, { status: 201 });
}
