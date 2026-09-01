import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { measurements, uploads } from '@/db/schema';
import { cleanExpiredPrivateUploads } from '@/lib/upload-expiry-cleanup';

async function uploadForOwner(id: string, ownerId: string) {
  const row = await getDb().select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.ownerId, ownerId))).limit(1);
  return row[0] ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);
  const upload = await uploadForOwner((await params).id, user.userId);
  if (!upload || (upload.status !== 'pending' && upload.status !== 'retained') || (upload.status === 'pending' && upload.expiresAt <= new Date())) return Response.json({ error: 'Upload not found.' }, { status: 404 });
  const object = await env.FILES.get(upload.storageKey);
  if (!object) return Response.json({ error: 'Upload not found.' }, { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': upload.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  await cleanExpiredPrivateUploads().catch(() => undefined);
  const upload = await uploadForOwner((await params).id, user.userId);
  if (!upload || (upload.status !== 'pending' && upload.status !== 'retained')) return Response.json({ error: 'Upload not found.' }, { status: 404 });
  try {
    await env.FILES.delete(upload.storageKey);
    await getDb().update(uploads).set({ status: 'deleted', deletedAt: new Date() }).where(and(eq(uploads.id, upload.id), eq(uploads.ownerId, user.userId)));
    await getDb().update(measurements).set({ sourceUploadId: null, provenance: 'user_confirmed_report' }).where(and(eq(measurements.ownerId, user.userId), eq(measurements.sourceUploadId, upload.id)));
  } catch {
    return Response.json({ error: 'The private upload could not be deleted. Please try again.' }, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
