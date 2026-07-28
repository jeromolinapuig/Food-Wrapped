import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHeicPhoto, preparePhotoForCrop } from './photoFile';

const heicToMock = vi.hoisted(() => vi.fn());

vi.mock('heic-to/csp', () => ({
  heicTo: heicToMock,
}));

beforeEach(() => {
  heicToMock.mockReset();
  heicToMock.mockResolvedValue(
    new Blob(['jpeg'], { type: 'image/jpeg' }),
  );
});

describe('photo file preparation', () => {
  it('keeps browser-compatible photos unchanged', async () => {
    const photo = new File(['jpeg'], 'burger.jpg', {
      type: 'image/jpeg',
    });

    await expect(preparePhotoForCrop(photo)).resolves.toBe(photo);
    expect(heicToMock).not.toHaveBeenCalled();
  });

  it('converts HEIC photos to JPEG before cropping', async () => {
    const photo = new File(['heic'], 'burger.HEIC', {
      type: 'image/heic',
      lastModified: 1234,
    });

    const prepared = await preparePhotoForCrop(photo);

    expect(heicToMock).toHaveBeenCalledWith({
      blob: photo,
      type: 'image/jpeg',
      quality: 0.92,
    });
    expect(prepared.name).toBe('burger.jpg');
    expect(prepared.type).toBe('image/jpeg');
    expect(prepared.lastModified).toBe(1234);
  });

  it('recognizes HEIC content when metadata is missing', async () => {
    const header = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18,
      ...Array.from('ftypheic', (character) => character.charCodeAt(0)),
    ]);
    const photo = new File([header], 'mobile-photo', { type: '' });

    await expect(isHeicPhoto(photo)).resolves.toBe(true);
  });
});
