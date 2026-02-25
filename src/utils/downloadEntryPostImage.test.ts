import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadEntryPostImage } from './downloadEntryPostImage';

describe('downloadEntryPostImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('genera imagen y lanza descarga en desktop', async () => {
    const ctx = {
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      fillStyle: '',
      font: '',
      textBaseline: '',
      measureText: vi.fn(() => ({ width: 120 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toBlob: (cb: BlobCallback) => cb(new Blob(['x'], { type: 'image/png' })),
    } as unknown as HTMLCanvasElement;

    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { click, remove, rel: '', href: '', download: '' } as unknown as HTMLAnchorElement;

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return canvas as unknown as HTMLElement;
      if (tagName === 'a') return anchor as unknown as HTMLElement;
      return originalCreateElement(tagName);
    });
    vi.spyOn(document.body, 'append').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://file');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: async () => new Blob(['img']),
    } as Response);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 100, height: 100, close: vi.fn() }))
    );

    await downloadEntryPostImage({
      restaurantName: 'Burger Place',
      burgerName: 'Smash',
      ratingValue: '4.5',
      photoUrl: 'https://example.com/photo.jpg',
      notes: 'nota',
    });

    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
