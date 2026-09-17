import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  authorizePrivateRequest,
  type PrivateAuthDependencies,
  type PrivateAuthSettings,
} from './private-auth-proxy';

const settings = {
  authMode: 'cloudflare_access',
  cloudflareAccessAudience: 'nourishwell-access-aud',
  cloudflareAccessTeamDomain: 'https://nourishwell.cloudflareaccess.com',
} satisfies PrivateAuthSettings;
const keyId = 'private-auth-proxy-key';
let privateKey: CryptoKey;
let dependencies: PrivateAuthDependencies;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  dependencies = {
    findCloudflareAccessOwner: async (identity) =>
      identity.subject === 'known-access-subject'
        ? { ownerId: 'existing-owner-id' }
        : null,
    getCloudflareAccessKey: createLocalJWKSet({
      keys: [{ ...publicJwk, alg: 'RS256', kid: keyId }],
    }),
  };
});

async function accessHeaders(subject = 'known-access-subject') {
  const token = await new SignJWT({ email: 'owner@example.test' })
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(settings.cloudflareAccessTeamDomain)
    .setAudience(settings.cloudflareAccessAudience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  return new Headers({
    'Cf-Access-Jwt-Assertion': token,
    'oai-authenticated-user-email': 'spoofed@example.test',
    'oai-authenticated-user-full-name': 'Spoofed',
    'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
    'oai-authenticated-user-id': 'spoofed-owner-id',
  });
}

describe('private auth proxy decision', () => {
  it('keeps ChatGPT authentication as the default cutover fallback', async () => {
    await expect(
      authorizePrivateRequest(new Headers(), {}, dependencies),
    ).resolves.toEqual({ type: 'passthrough' });
    await expect(
      authorizePrivateRequest(
        new Headers(),
        { authMode: 'chatgpt' },
        dependencies,
      ),
    ).resolves.toEqual({ type: 'passthrough' });
  });

  it('overwrites spoofable identity headers after a valid mapped assertion', async () => {
    const decision = await authorizePrivateRequest(
      await accessHeaders(),
      settings,
      dependencies,
    );
    expect(decision.type).toBe('authenticated');
    if (decision.type !== 'authenticated') return;
    expect(decision.requestHeaders.get('oai-authenticated-user-id')).toBe(
      'existing-owner-id',
    );
    expect(decision.requestHeaders.get('oai-authenticated-user-email')).toBe(
      'owner@example.test',
    );
    expect(
      decision.requestHeaders.has('oai-authenticated-user-full-name'),
    ).toBe(false);
    expect(
      decision.requestHeaders.has('oai-authenticated-user-full-name-encoding'),
    ).toBe(false);
  });

  it('returns 403 for missing, invalid, or unmapped Access identities', async () => {
    await expect(
      authorizePrivateRequest(new Headers(), settings, dependencies),
    ).resolves.toEqual({
      type: 'denied',
      reason: 'access_denied',
      status: 403,
    });
    await expect(
      authorizePrivateRequest(
        await accessHeaders('unknown-subject'),
        settings,
        dependencies,
      ),
    ).resolves.toEqual({
      type: 'denied',
      reason: 'access_denied',
      status: 403,
    });
  });

  it('fails closed with 503 for configuration or identity-store failures', async () => {
    await expect(
      authorizePrivateRequest(
        await accessHeaders(),
        { ...settings, cloudflareAccessAudience: '' },
        dependencies,
      ),
    ).resolves.toEqual({
      type: 'denied',
      reason: 'authentication_unavailable',
      status: 503,
    });
    await expect(
      authorizePrivateRequest(
        await accessHeaders(),
        { authMode: 'unexpected' },
        dependencies,
      ),
    ).resolves.toEqual({
      type: 'denied',
      reason: 'authentication_unavailable',
      status: 503,
    });
    await expect(
      authorizePrivateRequest(await accessHeaders(), settings, {
        ...dependencies,
        findCloudflareAccessOwner: async () => {
          throw new Error('D1 unavailable');
        },
      }),
    ).resolves.toEqual({
      type: 'denied',
      reason: 'authentication_unavailable',
      status: 503,
    });
  });
});
