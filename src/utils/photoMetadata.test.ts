import { describe, expect, it } from 'vitest';
import { getPhotoTakenDateTime } from './photoMetadata';

describe('photo metadata utils', () => {
  it('reads DateTimeOriginal from jpeg exif metadata', async () => {
    const file = new File([buildExifJpeg('2026:02:03 10:15:00')], 'burger.jpg', {
      type: 'image/jpeg',
    });

    await expect(getPhotoTakenDateTime(file)).resolves.toBe('2026-02-03T10:15');
  });

  it('returns null when the image has no exif date', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'burger.jpg', {
      type: 'image/jpeg',
    });

    await expect(getPhotoTakenDateTime(file)).resolves.toBeNull();
  });

  it('returns null for non-jpeg files', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'burger.png', {
      type: 'image/png',
    });

    await expect(getPhotoTakenDateTime(file)).resolves.toBeNull();
  });
});

function buildExifJpeg(dateTime: string) {
  const exifPayload = buildExifPayload(dateTime);
  const segmentLength = exifPayload.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    segmentLength >> 8,
    segmentLength & 0xff,
    ...exifPayload,
    0xff,
    0xd9,
  ]);
}

function buildExifPayload(dateTime: string) {
  const header = asciiBytes('Exif\0\0');
  const tiff = new Uint8Array(64);
  const view = new DataView(tiff.buffer);
  const exifIfdOffset = 26;
  const dateOffset = 44;
  const dateBytes = asciiBytes(`${dateTime}\0`);

  tiff.set(asciiBytes('II'), 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8769, true);
  view.setUint16(12, 4, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, exifIfdOffset, true);

  view.setUint16(exifIfdOffset, 1, true);
  view.setUint16(exifIfdOffset + 2, 0x9003, true);
  view.setUint16(exifIfdOffset + 4, 2, true);
  view.setUint32(exifIfdOffset + 6, dateBytes.length, true);
  view.setUint32(exifIfdOffset + 10, dateOffset, true);
  tiff.set(dateBytes, dateOffset);

  const payload = new Uint8Array(header.length + tiff.length);
  payload.set(header, 0);
  payload.set(tiff, header.length);
  return payload;
}

function asciiBytes(value: string) {
  return Uint8Array.from(value, (char) => char.charCodeAt(0));
}
