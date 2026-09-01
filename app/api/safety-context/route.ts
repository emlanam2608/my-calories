import { getChatGPTUser } from '@/app/chatgpt-auth';
import { resolveEffectiveSafetyContextForOwner } from '@/lib/effective-safety-context-server';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Sign in is required.' }, { status: 401 });

  const context = await resolveEffectiveSafetyContextForOwner(user.userId);

  return Response.json({ context }, { headers: { 'Cache-Control': 'no-store' } });
}
