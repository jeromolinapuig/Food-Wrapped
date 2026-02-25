import { describe, expect, it, vi } from 'vitest';
import { compressImage } from './image';

describe('image utils', () => {
  it('compresses image and returns jpg file', async () => {
    const input = new File(['abc'], 'photo.png', { type: 'image/png' });
    const urlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const originalImage = globalThis.Image;
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: class {
        width = 1200;
        height = 900;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    });

    const toBlob = vi.fn((cb: BlobCallback) => cb?.(new Blob(['x'], { type: 'image/jpeg' })));
    const drawImage = vi.fn();
    const getContext = vi.fn(() => ({ drawImage }));
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext, toBlob } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tag);
    });

    const compressed = await compressImage(input);
    expect(compressed.name.endsWith('.jpg')).toBe(true);
    expect(compressed.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalled();
    expect(urlSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: originalImage,
    });
    urlSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
