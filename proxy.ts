import { env } from 'cloudflare:workers';
import { NextResponse, type NextRequest } from 'next/server';
import { findCloudflareAccessOwner } from '@/lib/cloudflare-access-identity';
import { authorizePrivateRequest } from '@/lib/private-auth-proxy';

export async function proxy(request: NextRequest): Promise<Response> {
  const decision = await authorizePrivateRequest(
    request.headers,
    {
      authMode: env.AUTH_MODE,
      cloudflareAccessAudience: env.CF_ACCESS_AUD,
      cloudflareAccessTeamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    },
    { findCloudflareAccessOwner },
  );

  if (decision.type === 'passthrough') return NextResponse.next();
  if (decision.type === 'authenticated') {
    return NextResponse.next({
      request: { headers: decision.requestHeaders },
    });
  }

  const isApiRequest = new URL(request.url).pathname.startsWith('/api/');
  const message =
    decision.status === 403
      ? 'Access denied.'
      : 'Private authentication is temporarily unavailable.';
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': isApiRequest
      ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8',
  };
  if (decision.reason === 'authentication_unavailable') {
    console.error(
      JSON.stringify({
        event: 'private_authentication_unavailable',
        path: new URL(request.url).pathname,
      }),
    );
  }
  return new Response(
    isApiRequest ? JSON.stringify({ error: message }) : message,
    { status: decision.status, headers },
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)',
  ],
};
