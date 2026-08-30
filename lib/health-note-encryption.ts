import type { SensitiveNotes } from './contracts';

export type EncryptedHealthNotes = {
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
};

export type HealthNoteEncryptionConfig = {
  key: string;
  keyVersion: string;
};

export class HealthNoteEncryptionError extends Error {}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function cryptoKey(config: HealthNoteEncryptionConfig) {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(config.key);
  } catch {
    throw new HealthNoteEncryptionError('Sensitive-note encryption is not configured.');
  }
  if (raw.byteLength !== 32 || !config.keyVersion.trim())
    throw new HealthNoteEncryptionError('Sensitive-note encryption is not configured.');
  const keyBytes = raw.buffer.slice(
    raw.byteOffset,
    raw.byteOffset + raw.byteLength,
  ) as ArrayBuffer;
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function configuredHealthNoteEncryption(): HealthNoteEncryptionConfig | null {
  const key = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  const keyVersion = process.env.HEALTH_DATA_ENCRYPTION_KEY_VERSION ?? 'v1';
  return key ? { key, keyVersion } : null;
}

export async function encryptHealthNotes(
  notes: SensitiveNotes,
  config: HealthNoteEncryptionConfig,
): Promise<EncryptedHealthNotes> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(notes));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(config),
    plaintext,
  );
  return {
    algorithm: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptHealthNotes(
  encrypted: EncryptedHealthNotes,
  config: HealthNoteEncryptionConfig,
): Promise<SensitiveNotes> {
  if (encrypted.algorithm !== 'AES-GCM')
    throw new HealthNoteEncryptionError('Sensitive-note data could not be decrypted.');
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(encrypted.iv) },
      await cryptoKey(config),
      base64ToBytes(encrypted.ciphertext),
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload');
    return parsed as SensitiveNotes;
  } catch (error) {
    if (error instanceof HealthNoteEncryptionError) throw error;
    throw new HealthNoteEncryptionError('Sensitive-note data could not be decrypted.');
  }
}
