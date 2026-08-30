const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedImageType = (typeof supportedImageTypes)[number];

export function isSupportedImageType(value: string): value is SupportedImageType {
  return supportedImageTypes.includes(value as SupportedImageType);
}

export function imageDimensions(bytes: Uint8Array, type: SupportedImageType) {
  if (type === 'image/png') {
    if (bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null;
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }
  if (type === 'image/jpeg') return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] * 2 ** 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] };
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null;
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  if (kind === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
  if (kind === 'VP8 ') return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  return null;
}
