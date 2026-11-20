import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { demoSortOrder } = require('./demo-sort-answers');

const LABELS = ['Parkeren', 'Groen', 'Verkeersveiligheid', 'Verlichting'];

describe('demoSortOrder', () => {
  it('returns the same order for the same submission', () => {
    for (let i = 0; i < 20; i++) {
      expect(demoSortOrder(i, LABELS)).toEqual(demoSortOrder(i, LABELS));
    }
  });

  it('always returns a permutation of the labels', () => {
    for (let i = 0; i < 192; i++) {
      expect([...demoSortOrder(i, LABELS)].sort()).toEqual([...LABELS].sort());
    }
  });

  it('gives the options clearly different average places', () => {
    const sums = Object.fromEntries(LABELS.map((label) => [label, 0]));
    for (let i = 0; i < 192; i++) {
      demoSortOrder(i, LABELS).forEach((label, place) => {
        sums[label] += place + 1;
      });
    }
    const averages = Object.values(sums).map((sum) => sum / 192);
    expect(
      Math.max(...averages) - Math.min(...averages)
    ).toBeGreaterThanOrEqual(0.5);
    expect(sums.Groen / 192).toBeLessThan(sums.Verlichting / 192);
  });
});
