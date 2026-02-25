import { describe, expect, it, vi } from 'vitest';
import { cropImageFile } from './cropImage';

describe('cropImage utils', () => {
  it('returns cropped jpeg file', async () => {
    const input = new File(['abc'], 'avatar.png', { type: 'image/png' });
    const bitmap = {} as ImageBitmap;
    const bitmapMock = vi.fn(async () => bitmap);
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: bitmapMock,
    });

    const drawImage = vi.fn();
    const getContext = vi.fn(() => ({ drawImage }));
    const toBlob = vi.fn((cb: BlobCallback) => cb?.(new Blob(['x'], { type: 'image/jpeg' })));
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext, toBlob } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tag);
    });

    const out = await cropImageFile(input, { x: 1, y: 2, width: 10, height: 20 });
    expect(out.name).toBe('avatar.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('falls back to input file when canvas context is unavailable', async () => {
    const input = new File(['abc'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: vi.fn(async () => ({} as ImageBitmap)),
    });

    const toBlob = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => null, toBlob } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tag);
    });

    const out = await cropImageFile(input, { x: 0, y: 0, width: 10, height: 10 });
    expect(out).toBe(input);
    createElementSpy.mockRestore();
  });
});
