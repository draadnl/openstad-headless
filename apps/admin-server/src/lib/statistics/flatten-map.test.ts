// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAP_IMAGE_MIME,
  MAP_TOTAL_BUDGET,
  drawBox,
  fitDataUrlToBudget,
  flattenMapToImage,
  pinsShareOneDrawing,
  svgToDataUrl,
} from './flatten-map';

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function buildMap() {
  const map = document.createElement('div');
  map.innerHTML =
    '<img class="leaflet-tile" src="https://a.tile.openstreetmap.org/3/1/2.png">' +
    '<div class="leaflet-overlay-pane"><svg></svg></div>' +
    '<div class="leaflet-marker-icon"><svg></svg></div>' +
    '<div class="leaflet-marker-icon"><svg></svg></div>';
  const tile = map.querySelector('img') as HTMLImageElement;
  Object.defineProperty(tile, 'complete', { value: true });
  Object.defineProperty(tile, 'naturalWidth', { value: 256 });
  return map;
}

function mockDom(map: HTMLElement) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this === map ? rect(0, 0, 200, 100) : rect(10, 10, 20, 30);
    }
  );
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(
    rect(0, 0, 200, 100)
  );
  vi.stubGlobal(
    'Image',
    class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      set src(_value: string) {
        queueMicrotask(() => this.onload());
      }
    }
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('flattenMapToImage', () => {
  it('draws tiles, shapes and every pin and returns a jpeg', async () => {
    const map = buildMap();
    mockDom(map);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage,
      fillStyle: '',
      fillText: vi.fn(),
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,AAAA');

    const image = await flattenMapToImage(map);

    expect(image).toBe('data:image/jpeg;base64,AAAA');
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    // 1 tile + 1 overlay + 2 pins
    expect(drawImage).toHaveBeenCalledTimes(4);
  });

  it('skips the tiles when asked', async () => {
    const map = buildMap();
    mockDom(map);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage,
      fillStyle: '',
      fillText: vi.fn(),
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,AAAA'
    );

    await flattenMapToImage(map, { tiles: false });

    expect(drawImage).toHaveBeenCalledTimes(3);
  });

  it('returns null when the canvas is tainted', async () => {
    const map = buildMap();
    mockDom(map);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
      fillText: vi.fn(),
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      () => {
        throw new Error('tainted');
      }
    );

    expect(await flattenMapToImage(map)).toBeNull();
  });

  it('returns null for a map without size', async () => {
    const map = buildMap();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rect(0, 0, 0, 0)
    );
    expect(await flattenMapToImage(map)).toBeNull();
  });
});

function stubContext() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    fillText: vi.fn(),
    measureText: () => ({ width: 100 }),
  } as unknown as CanvasRenderingContext2D);
}

describe('fitDataUrlToBudget', () => {
  it('renders once when the first try fits the budget', () => {
    const render = vi.fn(() => 'data:image/jpeg;base64,AA');
    const result = fitDataUrlToBudget(render, { startScale: 2 });
    expect(result).toBe('data:image/jpeg;base64,AA');
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(2, 0.8);
  });

  it('renders with decreasing scales until it fits the budget', () => {
    const render = vi.fn((scale: number) =>
      'x'.repeat(Math.round(scale * 100))
    );
    const result = fitDataUrlToBudget(render, {
      startScale: 2,
      maxChars: 100,
    });
    const scales = render.mock.calls.map((call) => call[0]);
    expect(result).not.toBeNull();
    expect((result as string).length).toBeLessThanOrEqual(100);
    expect(scales.length).toBeGreaterThan(1);
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThan(scales[i - 1]);
    }
  });

  it('never goes below the minimum scale and returns null when nothing fits', () => {
    const render = vi.fn(() => 'x'.repeat(1000));
    const result = fitDataUrlToBudget(render, {
      startScale: 2,
      maxChars: 10,
      minScale: 0.4,
    });
    expect(result).toBeNull();
    const scales = render.mock.calls.map((call) => call[0]);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.4);
    // The last try uses a lower quality at the minimum scale.
    expect(render).toHaveBeenLastCalledWith(0.4, 0.6);
  });
});

describe('flattenMapToImage budget', () => {
  it('stays within the budget on a retina screen', async () => {
    const map = buildMap();
    mockDom(map);
    vi.stubGlobal('devicePixelRatio', 2);
    stubContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      function (this: HTMLCanvasElement) {
        return `data:image/jpeg;base64,${'x'.repeat(this.width * 800)}`;
      }
    );

    const image = await flattenMapToImage(map);

    expect(image).not.toBeNull();
    expect((image as string).length).toBeLessThanOrEqual(200_000);
  });

  it('returns null when the image can never fit the budget', async () => {
    const map = buildMap();
    mockDom(map);
    stubContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      `data:image/jpeg;base64,${'x'.repeat(300_000)}`
    );

    expect(await flattenMapToImage(map)).toBeNull();
  });
});

describe('on-screen positions', () => {
  it('on-screen: the overlay data url has no translate3d transform', () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('style', 'transform: translate3d(-82px, -37px, 0px)');
    const url = svgToDataUrl(svg, 200, 100);
    expect(decodeURIComponent(url)).not.toContain('translate3d');
  });

  it('on-screen: drawBox is relative to the map box', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
      rect(140, 90, 20, 30)
    );
    expect(drawBox(el, { left: 100, top: 50 })).toEqual({
      x: 40,
      y: 40,
      width: 20,
      height: 30,
    });
  });

  it('on-screen: pins and overlay are drawn at their own rect relative to the map', async () => {
    const map = buildMap();
    const overlayEl = map.querySelector('.leaflet-overlay-pane svg')!;
    const markers = Array.from(map.querySelectorAll('.leaflet-marker-icon'));
    const rects = new Map<Element, DOMRect>([
      [map, rect(100, 50, 200, 100)],
      [overlayEl, rect(80, 30, 300, 200)],
      [markers[0], rect(133, 77, 25, 41)],
      [markers[1], rect(171, 99, 25, 41)],
    ]);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return rects.get(this) ?? rect(0, 0, 256, 256);
      }
    );
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: SVGElement) {
        return rects.get(this) ?? rect(0, 0, 25, 41);
      }
    );
    vi.stubGlobal(
      'Image',
      class {
        onload: () => void = () => {};
        onerror: () => void = () => {};
        set src(_value: string) {
          queueMicrotask(() => this.onload());
        }
      }
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage,
      fillStyle: '',
      fillText: vi.fn(),
      measureText: () => ({ width: 100 }),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,AAAA'
    );

    await flattenMapToImage(map, { tiles: false });

    const args = drawImage.mock.calls.map((c) => c.slice(1));
    expect(args).toContainEqual([-20, -20, 300, 200]);
    expect(args).toContainEqual([33, 27, 25, 41]);
    expect(args).toContainEqual([71, 49, 25, 41]);
  });
});

function ctxWithFillText() {
  const fillText = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    fillText,
    measureText: () => ({ width: 100 }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/jpeg;base64,AAAA'
  );
  return fillText;
}

describe('pinsShareOneDrawing', () => {
  it('is true for identical pins', () => {
    const map = buildMap();
    mockDom(map);
    const markers = Array.from(
      map.querySelectorAll<HTMLElement>('.leaflet-marker-icon')
    );
    expect(pinsShareOneDrawing(markers)).toBe(true);
  });

  it('is false when the svg differs', () => {
    const map = buildMap();
    mockDom(map);
    const markers = Array.from(
      map.querySelectorAll<HTMLElement>('.leaflet-marker-icon')
    );
    markers[1].innerHTML = '<svg><circle r="2"></circle></svg>';
    expect(pinsShareOneDrawing(markers)).toBe(false);
  });

  it('is false when the size differs', () => {
    const map = buildMap();
    const markers = Array.from(
      map.querySelectorAll<HTMLElement>('.leaflet-marker-icon')
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this === markers[1] ? rect(0, 0, 40, 50) : rect(0, 0, 20, 30);
      }
    );
    expect(pinsShareOneDrawing(markers)).toBe(false);
  });

  it('flattenMapToImage logs an error when pins differ and still draws', async () => {
    const map = buildMap();
    mockDom(map);
    ctxWithFillText();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const markers = map.querySelectorAll('.leaflet-marker-icon');
    markers[1].innerHTML = '<svg><circle r="2"></circle></svg>';
    const image = await flattenMapToImage(map);
    expect(image).toBe('data:image/jpeg;base64,AAAA');
    expect(error).toHaveBeenCalledWith(
      'Map pins differ; flatten-map draws every pin like the first one'
    );
  });

  it('does not log when pins are identical', async () => {
    const map = buildMap();
    mockDom(map);
    ctxWithFillText();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await flattenMapToImage(map);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('OSM attribution', () => {
  it('draws the attribution when tiles are drawn', async () => {
    const map = buildMap();
    mockDom(map);
    const fillText = ctxWithFillText();
    await flattenMapToImage(map);
    expect(fillText).toHaveBeenCalledWith(
      '© OpenStreetMap-bijdragers',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('does not draw the attribution without tiles', async () => {
    const map = buildMap();
    mockDom(map);
    const fillText = ctxWithFillText();
    await flattenMapToImage(map, { tiles: false });
    expect(fillText).not.toHaveBeenCalled();
  });
});

describe('map budget option', () => {
  it('exports the shared budget and the image mime', () => {
    expect(MAP_TOTAL_BUDGET).toBe(200_000);
    expect(MAP_IMAGE_MIME).toBe('image/jpeg');
  });

  it('passes maxChars to the budget fitting', async () => {
    const map = buildMap();
    mockDom(map);
    ctxWithFillText();
    // 22 chars fit the default budget but not a budget of 10.
    const small = await flattenMapToImage(map, { maxChars: 10 });
    expect(small).toBeNull();
    const big = await flattenMapToImage(map, { maxChars: 100 });
    expect(big).toBe('data:image/jpeg;base64,AAAA');
  });
});
