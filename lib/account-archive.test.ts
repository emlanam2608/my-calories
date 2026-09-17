import { describe, expect, it } from 'vitest';
import { accountArchiveFilename, accountArchiveFormat, archiveUploadLimitBytes, archiveUploadPreflight, bytesToArchiveBase64 } from './account-archive';
import { assertOwnerDataInventory, assertPublicArchiveOwnerDataInventory, ownerDataInventory, publicArchiveOwnerDataInventory } from './owner-data-inventory';

describe('account archive helpers', () => {
  it('uses a versioned private archive format', () => {
    expect(accountArchiveFormat).toBe('nourishwell-private-archive-v4');
    expect(accountArchiveFilename('2026-09-01')).toBe('nourishwell-private-archive-2026-09-01.json');
  });

  it('rejects archives that exceed the temporary private-upload safety limit', () => {
    expect(archiveUploadPreflight([{ byteSize: archiveUploadLimitBytes + 1, status: 'retained' }])).toMatchObject({ allowed: false, reason: 'bytes' });
    expect(archiveUploadPreflight([{ byteSize: archiveUploadLimitBytes + 1, status: 'deleted' }])).toMatchObject({ allowed: true });
    expect(archiveUploadPreflight(Array.from({ length: 26 }, () => ({ byteSize: 1, status: 'retained' })))).toMatchObject({ allowed: false, reason: 'count' });
  });

  it('keeps archive and deletion scope aligned with the reviewed owner-data inventory', () => {
    expect(() => assertOwnerDataInventory(ownerDataInventory)).not.toThrow();
    expect(() => assertOwnerDataInventory(['profile'])).toThrow('Owner data inventory mismatch');
    expect(() => assertPublicArchiveOwnerDataInventory(publicArchiveOwnerDataInventory)).not.toThrow();
    expect(() => assertPublicArchiveOwnerDataInventory([...publicArchiveOwnerDataInventory, 'requestDeduplications'])).toThrow('Public archive inventory mismatch');
  });

  it('encodes upload bytes without changing their content', () => {
    expect(bytesToArchiveBase64(new Uint8Array([0, 255, 65]))).toBe('AP9B');
  });
});
