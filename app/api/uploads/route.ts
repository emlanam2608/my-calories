import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { uploads } from '@/db/schema';
import { uploadKindSchema, uploadResponseSchema } from '@/lib/contracts';
import { imageDimensions, isSupportedImageType } from '@/lib/image-validation';
import { cleanExpiredPrivateUploads } from '@/lib/upload-expiry-cleanup';

const maxBytes = 10_000_000;
const expiryMs = 24 * 60 * 60 * 1_000;

function extension(type: 'image/jpeg' | 'image/png' | 'image/webp') {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const kind = uploadKindSchema.safeParse(formData?.get('kind'));
  if (!(file instanceof File) || !kind.success)
    return Response.json({ error: 'Choose an image and a supported capture type.' }, { status: 400 });
  if (!isSupportedImageType(file.type) || file.size < 1 || file.size > maxBytes)
    return Response.json({ error: 'Use a JPEG, PNG, or WebP image no larger than 10 MB.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = imageDimensions(bytes, file.type);
  if (!dimensions || dimensions.width < 16 || dimensions.height < 16 || dimensions.width > 8_000 || dimensions.height > 8_000)
    return Response.json({ error: 'The image content or dimensions could not be verified.' }, { status: 400 });
  const id = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMs);
  const storageKey = `uploads/${id}.${extension(file.type)}`;
  try {
    await env.FILES.put(storageKey, bytes, { httpMetadata: { contentType: file.type } });
    await getDb().insert(uploads).values({ id, ownerId: user.userId, storageKey, kind: kind.data, contentType: file.type, byteSize: file.size, width: dimensions.width, height: dimensions.height, status: 'pending', expiresAt, createdAt: now, deletedAt: null });
  } catch {
    await env.FILES.delete(storageKey).catch(() => undefined);
    return Response.json({ error: 'The private upload could not be saved. Please try again.' }, { status: 503 });
  }
  return Response.json(uploadResponseSchema.parse({ id, kind: kind.data, contentType: file.type, byteSize: file.size, width: dimensions.width, height: dimensions.height, expiresAt: expiresAt.toISOString() }), { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);
  const rows = await getDb().select().from(uploads).where(eq(uploads.ownerId, user.userId));
  const now = new Date();
  return Response.json({ uploads: rows.filter((row) => row.status === 'pending' && row.expiresAt > now).map((row) => uploadResponseSchema.parse({ id: row.id, kind: row.kind, contentType: row.contentType, byteSize: row.byteSize, width: row.width, height: row.height, expiresAt: row.expiresAt.toISOString() })) }, { headers: { 'Cache-Control': 'no-store' } });
}
