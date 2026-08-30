import { describe, expect, it } from 'vitest';
import { decryptHealthNotes, encryptHealthNotes, HealthNoteEncryptionError } from './health-note-encryption';

const config = {
  key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  keyVersion: 'test-v1',
};

describe('health-note encryption', () => {
  it('round-trips free-text health notes with AES-GCM', async () => {
    const encrypted = await encryptHealthNotes(
      { medicationNote: 'Example only', clinicianNote: 'Keep intensity easy', symptomNote: '' },
      config,
    );
    expect(encrypted.ciphertext).not.toContain('Example only');
    await expect(decryptHealthNotes(encrypted, config)).resolves.toEqual({
      medicationNote: 'Example only', clinicianNote: 'Keep intensity easy', symptomNote: '',
    });
  });

  it('fails closed for tampered ciphertext and another key', async () => {
    const encrypted = await encryptHealthNotes(
      { medicationNote: '', clinicianNote: 'Clinician note', symptomNote: '' },
      config,
    );
    await expect(decryptHealthNotes({ ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` }, config)).rejects.toBeInstanceOf(HealthNoteEncryptionError);
    await expect(decryptHealthNotes(encrypted, { ...config, key: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' })).rejects.toBeInstanceOf(HealthNoteEncryptionError);
  });
});
