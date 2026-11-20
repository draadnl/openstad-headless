import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  DEMO_AREA_RING,
  insideRing,
  distanceToEdge,
  buildDemoPins,
} = require('./demo-map-pins');

describe('buildDemoPins', () => {
  const pins = buildDemoPins({ total: 192, seed: 1720, inset: 0.006 });

  it('places every pin inside the ring, away from the edge', () => {
    expect(pins).toHaveLength(192);
    for (const pin of pins) {
      expect(insideRing(pin, DEMO_AREA_RING)).toBe(true);
      // Pins are rounded to 5 decimals, so allow a tiny tolerance.
      expect(distanceToEdge(pin, DEMO_AREA_RING)).toBeGreaterThanOrEqual(
        0.006 - 1e-4
      );
    }
  });

  it('gives exactly the same list on every call', () => {
    expect(buildDemoPins({ total: 192, seed: 1720, inset: 0.006 })).toEqual(
      pins
    );
  });

  it('is not a grid', () => {
    expect(new Set(pins.map((p) => p.lat)).size).toBeGreaterThan(150);
  });

  it('throws for a ring too small for the inset', () => {
    const tiny = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.001, lng: 0.0005 },
    ];
    expect(() => buildDemoPins({ ring: tiny, total: 5, inset: 0.006 })).toThrow(
      /Could not place/
    );
  });
});
