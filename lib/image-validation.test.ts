import { describe, expect, it } from 'vitest';
import { imageDimensions } from './image-validation';

describe('image validation', () => {
  it('reads PNG dimensions without decoding the image', () => {
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    png.set([0, 0, 4, 0], 16);
    png.set([0, 0, 3, 0], 20);
    expect(imageDimensions(png, 'image/png')).toEqual({ width: 1024, height: 768 });
  });

  it('rejects a file whose declared type does not match its header', () => {
    expect(imageDimensions(new Uint8Array([1, 2, 3, 4]), 'image/jpeg')).toBeNull();
  });
});
