export type ExpiredUpload = {
  id: string;
  storageKey: string;
};

export async function cleanExpiredUploads(
  uploads: ExpiredUpload[],
  removeObject: (storageKey: string) => Promise<void>,
  markExpired: (id: string) => Promise<void>,
) {
  let deleted = 0;
  for (const upload of uploads) {
    try {
      await removeObject(upload.storageKey);
      await markExpired(upload.id);
      deleted += 1;
    } catch {
      // Keep the record pending so a later cleanup attempt can safely retry it.
    }
  }
  return deleted;
}
