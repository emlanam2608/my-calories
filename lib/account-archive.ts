export const accountArchiveFormat = 'nourishwell-private-archive-v4';
export const archiveUploadLimitBytes = 5_000_000;
export const archiveUploadLimitCount = 25;

export function accountArchiveFilename(date: string) {
  return `nourishwell-private-archive-${date}.json`;
}

export function bytesToArchiveBase64(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function archiveUploadPreflight(uploads: ReadonlyArray<{ byteSize: number; status: string }>) {
  const readable = uploads.filter((upload) => upload.status !== 'deleted' && upload.status !== 'expired');
  const totalBytes = readable.reduce((sum, upload) => sum + upload.byteSize, 0);
  if (readable.length > archiveUploadLimitCount)
    return { allowed: false, totalBytes, reason: 'count' as const };
  if (totalBytes > archiveUploadLimitBytes)
    return { allowed: false, totalBytes, reason: 'bytes' as const };
  return { allowed: true, totalBytes, reason: null };
}
