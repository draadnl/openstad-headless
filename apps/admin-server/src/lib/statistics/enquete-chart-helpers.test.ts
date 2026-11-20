import { describe, expect, it } from 'vitest';

import {
  CHART_COLORS,
  DONUT_OUTER,
  SKIPPED_COLOR,
  axisTicks,
  colorForIndex,
  donutCanvasSize,
  donutLabelPoint,
  niceAxisMax,
  rankingBarWidth,
  visibleDonutLabels,
} from './enquete-chart-helpers';

describe('colorForIndex', () => {
  it('follows the design order', () => {
    expect(CHART_COLORS).toHaveLength(8);
    expect(colorForIndex(0)).toBe('#7078e8');
    expect(colorForIndex(1)).toBe('#d3238e');
    expect(colorForIndex(7)).toBe('#5c7f24');
  });

  it('wraps around after the last colour', () => {
    expect(colorForIndex(8)).toBe(colorForIndex(0));
    expect(colorForIndex(10)).toBe(colorForIndex(2));
  });

  it('falls back to the first colour for bad input', () => {
    expect(colorForIndex(-1)).toBe(colorForIndex(0));
    expect(colorForIndex(NaN)).toBe(colorForIndex(0));
  });
});

describe('niceAxisMax', () => {
  it('rounds up to the next multiple of 20', () => {
    expect(niceAxisMax(112)).toBe(120);
    expect(niceAxisMax(120)).toBe(120);
    expect(niceAxisMax(121)).toBe(140);
  });

  it('never goes below 20', () => {
    expect(niceAxisMax(0)).toBe(20);
    expect(niceAxisMax(3)).toBe(20);
    expect(niceAxisMax(NaN)).toBe(20);
    expect(niceAxisMax(-5)).toBe(20);
  });
});

describe('axisTicks', () => {
  it('lists a tick every 20 including the maximum', () => {
    expect(axisTicks(120)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(axisTicks(20)).toEqual([0, 20]);
  });
});

describe('donut label placement', () => {
  it('keeps every donut label inside the canvas', () => {
    const { width, height } = donutCanvasSize();
    for (let angle = 0; angle < 360; angle++) {
      const { x, y } = donutLabelPoint(
        width / 2,
        height / 2,
        angle,
        DONUT_OUTER
      );
      expect(x - 18).toBeGreaterThanOrEqual(0);
      expect(x + 18).toBeLessThanOrEqual(width);
      expect(y - 8).toBeGreaterThanOrEqual(0);
      expect(y + 8).toBeLessThanOrEqual(height);
    }
  });
});

describe('SKIPPED_COLOR', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('has at least 3:1 contrast on white', () => {
    const ratio = 1.05 / (luminance(SKIPPED_COLOR) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

describe('rankingBarWidth', () => {
  it('gives a full bar for place 1 and 1/n for the last place', () => {
    expect(rankingBarWidth(1, 4)).toBe(1);
    expect(rankingBarWidth(4, 4)).toBe(0.25);
  });

  it('gives no bar without an average', () => {
    expect(rankingBarWidth(null, 4)).toBe(0);
  });

  it('stays between 0 and 1', () => {
    expect(rankingBarWidth(0.5, 3)).toBe(1);
    expect(rankingBarWidth(9, 3)).toBe(0);
  });
});

describe('visibleDonutLabels', () => {
  it('shows every label for a normal split (21/45/20/10/4)', () => {
    expect(visibleDonutLabels([21, 45, 20, 10, 4])).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('hides slices under 3%', () => {
    expect(visibleDonutLabels([98, 2])).toEqual([true, false]);
  });

  it('hides a label that sits too close to the previous visible one', () => {
    // 3% and 4% slices next to each other: mid angles are ~13 degrees apart.
    const result = visibleDonutLabels([46, 3, 4, 47]);
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
  });

  it('returns an empty list when the total is 0', () => {
    expect(visibleDonutLabels([])).toEqual([]);
    expect(visibleDonutLabels([0, 0])).toEqual([]);
  });
});
