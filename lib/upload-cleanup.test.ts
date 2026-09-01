import { describe, expect, it } from 'vitest';
import { cleanExpiredUploads } from './upload-cleanup';

describe('expired upload cleanup', () => {
  it('marks only objects that were deleted successfully', async () => {
    const marked: string[] = [];
    const deleted = await cleanExpiredUploads(
      [
        { id: 'first', storageKey: 'uploads/first.jpg' },
        { id: 'second', storageKey: 'uploads/second.jpg' },
      ],
      async (key) => {
        if (key.includes('second')) throw new Error('storage unavailable');
      },
      async (id) => {
        marked.push(id);
      },
    );
    expect(deleted).toBe(1);
    expect(marked).toEqual(['first']);
  });
});
