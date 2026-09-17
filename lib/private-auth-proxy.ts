import type { JWTVerifyGetKey } from 'jose';
import {
  authenticateCloudflareAccessRequest,
  CloudflareAccessAuthenticationError,
  type VerifiedCloudflareAccessIdentity,
} from './cloudflare-access-auth';
import {
  privateUserEmailHeader,
  privateUserFullNameEncodingHeader,
  privateUserFullNameHeader,
  privateUserIdHeader,
} from './private-auth-headers';

export type PrivateAuthSettings = {
  authMode?: string;
  cloudflareAccessAudience?: string;
  cloudflareAccessTeamDomain?: string;
};

export type PrivateAuthDecision =
  | { type: 'passthrough' }
  | { type: 'authenticated'; requestHeaders: Headers }
  | {
      type: 'denied';
      reason: 'access_denied' | 'authentication_unavailable';
      status: 403 | 503;
    };

export type PrivateAuthDependencies = {
  findCloudflareAccessOwner: (
    identity: VerifiedCloudflareAccessIdentity,
  ) => Promise<{ ownerId: string } | null>;
  getCloudflareAccessKey?: JWTVerifyGetKey;
};

export async function authorizePrivateRequest(
  requestHeaders: Headers,
  settings: PrivateAuthSettings,
  dependencies: PrivateAuthDependencies,
): Promise<PrivateAuthDecision> {
  const authMode = settings.authMode?.trim() || 'chatgpt';
  if (authMode === 'chatgpt') return { type: 'passthrough' };
  if (authMode !== 'cloudflare_access') return unavailableDecision();

  try {
    const user = await authenticateCloudflareAccessRequest(
      requestHeaders,
      {
        audience: settings.cloudflareAccessAudience ?? '',
        teamDomain: settings.cloudflareAccessTeamDomain ?? '',
      },
      {
        findOwner: dependencies.findCloudflareAccessOwner,
        getKey: dependencies.getCloudflareAccessKey,
      },
    );
    const trustedHeaders = new Headers(requestHeaders);
    trustedHeaders.set(privateUserIdHeader, user.userId);
    trustedHeaders.set(privateUserEmailHeader, user.email);
    trustedHeaders.delete(privateUserFullNameHeader);
    trustedHeaders.delete(privateUserFullNameEncodingHeader);
    return { type: 'authenticated', requestHeaders: trustedHeaders };
  } catch (error) {
    if (error instanceof CloudflareAccessAuthenticationError) {
      return error.status === 403
        ? { type: 'denied', reason: 'access_denied', status: 403 }
        : unavailableDecision();
    }
    return unavailableDecision();
  }
}

function unavailableDecision(): PrivateAuthDecision {
  return {
    type: 'denied',
    reason: 'authentication_unavailable',
    status: 503,
  };
}
