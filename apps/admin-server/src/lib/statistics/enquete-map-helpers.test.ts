import { describe, expect, it } from 'vitest';

import {
  PIN_SIZE,
  boundsOf,
  cutoutRings,
  flattenLatLngs,
  mapFitPadding,
  outlineRings,
  pinGeometry,
  pinLabel,
  scalePinHtml,
  unionBounds,
} from './enquete-map-helpers';

const ring = [
  { lat: 1, lng: 2 },
  { lat: 3, lng: 4 },
  { lat: 1, lng: 6 },
];

describe('flattenLatLngs', () => {
  it('flattens polygon, multipolygon and ignores broken input', () => {
    expect(flattenLatLngs([ring])).toHaveLength(3);
    expect(flattenLatLngs([[ring], [ring]])).toHaveLength(6);
    expect(flattenLatLngs(null)).toEqual([]);
    expect(flattenLatLngs([[{ lat: 'x' }]])).toEqual([]);
    expect(flattenLatLngs([[{ lat: NaN, lng: 1 }]])).toEqual([]);
  });
});

describe('boundsOf and unionBounds', () => {
  it('gives the box around points, null for none', () => {
    expect(boundsOf(ring)).toEqual([
      [1, 2],
      [3, 6],
    ]);
    expect(boundsOf([])).toBeNull();
  });

  it('joins two boxes and ignores a missing one', () => {
    const a: [[number, number], [number, number]] = [
      [1, 1],
      [2, 2],
    ];
    const b: [[number, number], [number, number]] = [
      [0, 3],
      [1, 4],
    ];
    expect(unionBounds(a, b)).toEqual([
      [0, 1],
      [2, 4],
    ]);
    expect(unionBounds(a, null)).toBe(a);
    expect(unionBounds(null, b)).toBe(b);
    expect(unionBounds(null, null)).toBeNull();
  });
});

describe('cutoutRings', () => {
  it('puts the world box first, then the area rings', () => {
    const rings = cutoutRings([ring]);
    expect(rings).toHaveLength(2);
    expect(rings[0][0]).toEqual([-90, -180]);
    expect(rings[1][0]).toEqual([1, 2]);
  });

  it('keeps every ring of a multipolygon, holes included', () => {
    expect(cutoutRings([[ring, ring], [ring]])).toHaveLength(4);
    expect(outlineRings([[ring, ring], [ring]])).toHaveLength(3);
  });

  it('returns nothing for empty or broken geometry', () => {
    expect(cutoutRings([])).toEqual([]);
    expect(cutoutRings(undefined)).toEqual([]);
    expect(cutoutRings([[{ lat: 1, lng: 1 }]])).toEqual([]);
  });
});

describe('map fit padding', () => {
  it('keeps room above for the pin head and a margin on every side', () => {
    const { paddingTopLeft, paddingBottomRight } = mapFitPadding();
    expect(paddingTopLeft[1]).toBe(PIN_SIZE.height + 4);
    for (const value of [
      paddingTopLeft[0],
      paddingBottomRight[0],
      paddingBottomRight[1],
    ]) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(8);
    }
  });
});

describe('pin icon', () => {
  it('is 22x28 with the anchor on the tip', () => {
    expect(PIN_SIZE).toEqual({ width: 22, height: 28, anchor: [11, 27] });
  });

  it('scales height and tip for another width (32)', () => {
    const geometry = pinGeometry(32);
    expect(geometry.height).toBe(41);
    expect(geometry.anchor).toEqual([16, 39]);
  });

  it('sets the svg size and keeps the paths', () => {
    const html =
      '<svg width="32" height="40" viewBox="-3 -3 44.2 56"><path d="M0"/></svg>';
    const result = scalePinHtml(html, PIN_SIZE);
    expect(result).toContain('width="22" height="28"');
    expect(result).toContain('viewBox="-3 -3 44.2 56"');
    expect(result).toContain('<path d="M0"/>');
  });

  it('returns non-svg input unchanged', () => {
    expect(scalePinHtml('<div width="1" height="2"></div>', PIN_SIZE)).toBe(
      '<div width="1" height="2"></div>'
    );
  });
});

describe('unionBounds with pins', () => {
  const area: [[number, number], [number, number]] = [
    [51, 4],
    [52, 5],
  ];

  it('keeps the area box when all pins lie inside it', () => {
    const pins = boundsOf([
      { lat: 51.2, lng: 4.2 },
      { lat: 51.8, lng: 4.9 },
    ]);
    expect(unionBounds(area, pins)).toEqual(area);
  });

  it('grows only on the side of a pin outside the area', () => {
    const pins = boundsOf([{ lat: 52.5, lng: 4.5 }]);
    expect(unionBounds(area, pins)).toEqual([
      [51, 4],
      [52.5, 5],
    ]);
  });
});

describe('pinLabel', () => {
  it('numbers the pin and rounds to 5 decimals', () => {
    expect(pinLabel({ lat: 52.1234567, lng: 5.3 }, 0, 3)).toBe(
      'Locatie 1 van 3: 52.12346, 5.30000'
    );
    expect(pinLabel({ lat: 1, lng: 2 }, 2, 3)).toBe(
      'Locatie 3 van 3: 1.00000, 2.00000'
    );
  });
});
