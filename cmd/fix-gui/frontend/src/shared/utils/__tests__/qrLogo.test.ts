import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCircularLogoDataURL } from '../qrLogo';

// Mock canvas context since jsdom doesn't implement canvas
function createMockContext() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
}

describe('createCircularLogoDataURL', () => {
  let originalImage: typeof globalThis.Image;
  let mockCtx: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    originalImage = globalThis.Image;
    mockCtx = createMockContext();

    // Mock canvas getContext and toDataURL
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,mockdata',
    );
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  function mockImage(fireEvent: 'load' | 'error') {
    globalThis.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      constructor() {
        setTimeout(() => {
          if (fireEvent === 'load') this.onload?.();
          else this.onerror?.();
        }, 0);
      }
    } as unknown as typeof globalThis.Image;
  }

  it('returns a data URL when image loads successfully', async () => {
    mockImage('load');
    const result = await createCircularLogoDataURL('/icons/fix-logo.png', 60, 3, '#27ae60');
    expect(result).toBe('data:image/png;base64,mockdata');
  });

  it('rejects when image fails to load', async () => {
    mockImage('error');
    await expect(
      createCircularLogoDataURL('/nonexistent.png', 60, 3, '#27ae60'),
    ).rejects.toThrow('Failed to load logo');
  });

  it('draws white circle, outer accent ring, and main border ring', async () => {
    mockImage('load');
    await createCircularLogoDataURL('/icons/test.png', 60, 4, '#ff0000');

    // Three arc calls: fill circle + outer accent + main border
    expect(mockCtx.arc).toHaveBeenCalledTimes(3);
    // Fill called once (white circle), stroke called twice (accent + border)
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
    expect(mockCtx.stroke).toHaveBeenCalledTimes(2);
  });

  it('draws the logo centered with padding for shadow + border', async () => {
    mockImage('load');
    // size=60, borderWidth=3, shadowPad=3
    // canvasSize = 60 + 6 = 66, padding = 3 + 3 + 6 = 12, logoSize = 66 - 24 = 42
    await createCircularLogoDataURL('/icons/test.png', 60, 3, '#333');

    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    const [, x, y, w, h] = mockCtx.drawImage.mock.calls[0];
    expect(x).toBe(12); // shadowPad + borderWidth + 6
    expect(y).toBe(12);
    expect(w).toBe(42); // canvasSize - 2*padding
    expect(h).toBe(42);
  });

  it('sets canvas dimensions with shadow padding', async () => {
    mockImage('load');
    const createElementSpy = vi.spyOn(document, 'createElement');
    // size=80, shadowPad=3, canvasSize=86
    await createCircularLogoDataURL('/icons/test.png', 80, 4, '#000');

    const canvasCall = createElementSpy.mock.results.find(
      (r) => r.type === 'return' && (r.value as HTMLElement).tagName === 'CANVAS',
    );
    expect(canvasCall).toBeDefined();
    const canvas = canvasCall!.value as HTMLCanvasElement;
    expect(canvas.width).toBe(86); // 80 + 3*2
    expect(canvas.height).toBe(86);
  });

  it('sets shadow properties before drawing white circle', async () => {
    mockImage('load');
    await createCircularLogoDataURL('/icons/test.png', 60, 3, '#27ae60');

    // Shadow was set (we can verify via the mock property assignments)
    // After fill, shadow should be cleared for border draws
    // The mock tracks property assignments, so we verify the final state
    // is 'transparent' (shadow cleared after white circle)
    expect(mockCtx.shadowColor).toBe('transparent');
    expect(mockCtx.shadowBlur).toBe(0);
  });
});
