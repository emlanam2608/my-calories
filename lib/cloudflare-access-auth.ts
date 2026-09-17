import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const cloudflareAccessProvider = 'cloudflare_access';
export const cloudflareAccessJwtHeader = 'cf-access-jwt-assertion';

export type CloudflareAccessConfig = {
  audience: string;
  teamDomain: string;
};

export type VerifiedCloudflareAccessIdentity = {
  email: string;
  issuer: string;
  subject: string;
};

export type PrivateUser = {
  displayName: string;
  email: string;
  fullName: null;
  userId: string;
};

export type CloudflareAccessFailureCode =
  | 'invalid_configuration'
  | 'missing_token'
  | 'invalid_token'
  | 'unmapped_identity';

export class CloudflareAccessAuthenticationError extends Error {
  readonly status: 403 | 503;

  constructor(readonly code: CloudflareAccessFailureCode) {
    super(code);
    this.name = 'CloudflareAccessAuthenticationError';
    this.status = code === 'invalid_configuration' ? 503 : 403;
  }
}

export function normalizeCloudflareAccessConfig(
  config: CloudflareAccessConfig,
): CloudflareAccessConfig {
  const audience = config.audience.trim();
  let teamDomain: URL;
  try {
    teamDomain = new URL(config.teamDomain);
  } catch {
    throw new CloudflareAccessAuthenticationError('invalid_configuration');
  }

  if (
    !audience ||
    teamDomain.protocol !== 'https:' ||
    !teamDomain.hostname.endsWith('.cloudflareaccess.com') ||
    teamDomain.username ||
    teamDomain.password ||
    teamDomain.port ||
    (teamDomain.pathname !== '/' && teamDomain.pathname !== '') ||
    teamDomain.search ||
    teamDomain.hash
  ) {
    throw new CloudflareAccessAuthenticationError('invalid_configuration');
  }

  return {
    audience,
    teamDomain: teamDomain.origin,
  };
}

export function cloudflareAccessCertsUrl(config: CloudflareAccessConfig): URL {
  const normalized = normalizeCloudflareAccessConfig(config);
  return new URL('/cdn-cgi/access/certs', normalized.teamDomain);
}

export async function verifyCloudflareAccessToken(
  token: string,
  config: CloudflareAccessConfig,
  getKey: JWTVerifyGetKey,
): Promise<VerifiedCloudflareAccessIdentity> {
  const normalized = normalizeCloudflareAccessConfig(config);
  if (!token.trim())
    throw new CloudflareAccessAuthenticationError('missing_token');

  try {
    const { payload } = await jwtVerify(token, getKey, {
      algorithms: ['RS256'],
      audience: normalized.audience,
      issuer: normalized.teamDomain,
    });
    const subject = payload.sub?.trim();
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (!subject || !email)
      throw new CloudflareAccessAuthenticationError('invalid_token');

    return {
      email,
      issuer: normalized.teamDomain,
      subject,
    };
  } catch (error) {
    if (error instanceof CloudflareAccessAuthenticationError) throw error;
    throw new CloudflareAccessAuthenticationError('invalid_token');
  }
}

type AccessAuthenticationDependencies = {
  findOwner: (
    identity: VerifiedCloudflareAccessIdentity,
  ) => Promise<{ ownerId: string } | null>;
  getKey?: JWTVerifyGetKey;
};

export async function authenticateCloudflareAccessRequest(
  requestHeaders: Headers,
  config: CloudflareAccessConfig,
  dependencies: AccessAuthenticationDependencies,
): Promise<PrivateUser> {
  const token = requestHeaders.get(cloudflareAccessJwtHeader);
  if (!token) throw new CloudflareAccessAuthenticationError('missing_token');

  const getKey =
    dependencies.getKey ?? createRemoteJWKSet(cloudflareAccessCertsUrl(config));
  const identity = await verifyCloudflareAccessToken(token, config, getKey);
  const owner = await dependencies.findOwner(identity);
  if (!owner)
    throw new CloudflareAccessAuthenticationError('unmapped_identity');

  return {
    displayName: identity.email,
    email: identity.email,
    fullName: null,
    userId: owner.ownerId,
  };
}
