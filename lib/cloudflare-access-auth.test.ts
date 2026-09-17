import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  authenticateCloudflareAccessRequest,
  CloudflareAccessAuthenticationError,
  cloudflareAccessCertsUrl,
  normalizeCloudflareAccessConfig,
  verifyCloudflareAccessToken,
} from './cloudflare-access-auth';

const config = {
  audience: 'nourishwell-access-aud',
  teamDomain: 'https://nourishwell.cloudflareaccess.com',
};
const keyId = 'access-test-key';
let privateKey: CryptoKey;
let getKey: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  getKey = createLocalJWKSet({
    keys: [{ ...publicJwk, alg: 'RS256', kid: keyId }],
  });
});

async function accessToken(
  overrides: {
    audience?: string;
    email?: string | null;
    expiresAt?: number;
    issuer?: string;
    subject?: string | null;
  } = {},
) {
  let token = new SignJWT(
    overrides.email === null
      ? {}
      : { email: overrides.email ?? 'owner@example.test' },
  )
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(overrides.issuer ?? config.teamDomain)
    .setAudience(overrides.audience ?? config.audience)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? '5m');
  if (overrides.subject !== null)
    token = token.setSubject(overrides.subject ?? 'access-owner-subject');
  return token.sign(privateKey);
}

async function expectFailure(
  operation: Promise<unknown>,
  code: CloudflareAccessAuthenticationError['code'],
) {
  await expect(operation).rejects.toMatchObject({ code, status: 403 });
}

describe('Cloudflare Access authentication', () => {
  it('normalizes only an HTTPS Cloudflare Access team domain', () => {
    expect(
      normalizeCloudflareAccessConfig({
        audience: ` ${config.audience} `,
        teamDomain: `${config.teamDomain}/`,
      }),
    ).toEqual(config);
    expect(cloudflareAccessCertsUrl(config).href).toBe(
      `${config.teamDomain}/cdn-cgi/access/certs`,
    );
    for (const teamDomain of [
      'http://nourishwell.cloudflareaccess.com',
      'https://example.com',
      `${config.teamDomain}/unexpected`,
    ]) {
      expect(() =>
        normalizeCloudflareAccessConfig({ ...config, teamDomain }),
      ).toThrow('invalid_configuration');
    }
  });

  it('verifies RS256 signature, issuer, audience, expiry, and required claims', async () => {
    await expect(
      verifyCloudflareAccessToken(await accessToken(), config, getKey),
    ).resolves.toEqual({
      email: 'owner@example.test',
      issuer: config.teamDomain,
      subject: 'access-owner-subject',
    });

    await expectFailure(
      verifyCloudflareAccessToken(
        await accessToken({ audience: 'other-app' }),
        config,
        getKey,
      ),
      'invalid_token',
    );
    await expectFailure(
      verifyCloudflareAccessToken(
        await accessToken({ issuer: 'https://other.cloudflareaccess.com' }),
        config,
        getKey,
      ),
      'invalid_token',
    );
    await expectFailure(
      verifyCloudflareAccessToken(
        await accessToken({ expiresAt: Math.floor(Date.now() / 1000) - 1 }),
        config,
        getKey,
      ),
      'invalid_token',
    );
    await expectFailure(
      verifyCloudflareAccessToken(
        await accessToken({ email: null }),
        config,
        getKey,
      ),
      'invalid_token',
    );
    await expectFailure(
      verifyCloudflareAccessToken(
        await accessToken({ subject: null }),
        config,
        getKey,
      ),
      'invalid_token',
    );
  });

  it('rejects a forged signature', async () => {
    const attacker = await generateKeyPair('RS256');
    const forged = await new SignJWT({ email: 'owner@example.test' })
      .setProtectedHeader({ alg: 'RS256', kid: keyId })
      .setIssuer(config.teamDomain)
      .setAudience(config.audience)
      .setSubject('access-owner-subject')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(attacker.privateKey);
    await expectFailure(
      verifyCloudflareAccessToken(forged, config, getKey),
      'invalid_token',
    );
  });

  it('maps only the verified issuer and subject, never the email', async () => {
    const knownToken = await accessToken();
    const knownHeaders = new Headers({
      'Cf-Access-Jwt-Assertion': knownToken,
    });
    await expect(
      authenticateCloudflareAccessRequest(knownHeaders, config, {
        getKey,
        findOwner: async (identity) =>
          identity.subject === 'access-owner-subject'
            ? { ownerId: 'existing-owner-id' }
            : null,
      }),
    ).resolves.toEqual({
      displayName: 'owner@example.test',
      email: 'owner@example.test',
      fullName: null,
      userId: 'existing-owner-id',
    });

    const sameEmailNewSubject = new Headers({
      'Cf-Access-Jwt-Assertion': await accessToken({
        subject: 'unknown-subject',
      }),
    });
    await expectFailure(
      authenticateCloudflareAccessRequest(sameEmailNewSubject, config, {
        getKey,
        findOwner: async () => null,
      }),
      'unmapped_identity',
    );
  });

  it('rejects a missing Access assertion', async () => {
    await expectFailure(
      authenticateCloudflareAccessRequest(new Headers(), config, {
        getKey,
        findOwner: async () => ({ ownerId: 'existing-owner-id' }),
      }),
      'missing_token',
    );
  });
});
