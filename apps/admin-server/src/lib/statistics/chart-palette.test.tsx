// @vitest-environment jsdom
import { BarRows } from '@/components/statistics/enquete/bar-rows';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ChartPaletteProvider, resolvePalette } from './chart-palette';
import { CHART_COLORS, colorForIndex } from './enquete-chart-helpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const options = [
  { label: 'Ja', count: 2, percentage: 67 },
  { label: 'Nee', count: 1, percentage: 33 },
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const render = (node: React.ReactNode) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
};
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('resolvePalette', () => {
  it('falls back to the default colours when empty, missing or invalid', () => {
    expect(resolvePalette(undefined)).toBe(CHART_COLORS);
    expect(resolvePalette([])).toBe(CHART_COLORS);
    expect(resolvePalette(['red', '#12'])).toBe(CHART_COLORS);
    expect(resolvePalette('#112233')).toBe(CHART_COLORS);
  });

  it('keeps only valid #RRGGBB values, max 8', () => {
    expect(resolvePalette(['#112233', 'nope', '#AABBCC'])).toEqual([
      '#112233',
      '#AABBCC',
    ]);
    const many = Array.from({ length: 12 }, () => '#000000');
    expect(resolvePalette(many)).toHaveLength(8);
  });
});

describe('colorForIndex with a palette', () => {
  it('uses the given palette and wraps around', () => {
    expect(colorForIndex(0, ['#111111', '#222222'])).toBe('#111111');
    expect(colorForIndex(3, ['#111111', '#222222'])).toBe('#222222');
    expect(colorForIndex(0)).toBe(CHART_COLORS[0]);
  });
});

describe('ChartPaletteProvider', () => {
  const dotColors = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('[style*="background"]')).map(
      (n) => n.style.backgroundColor
    );

  it('charts use the default colours without a provider', () => {
    const el = render(<BarRows options={options} ariaLabel="x" />);
    expect(dotColors(el)).toContain('rgb(112, 120, 232)');
  });

  it('charts use the project palette inside the provider', () => {
    const el = render(
      <ChartPaletteProvider colors={['#ff0000', '#00ff00']}>
        <BarRows options={options} ariaLabel="x" />
      </ChartPaletteProvider>
    );
    const colors = dotColors(el);
    expect(colors).toContain('rgb(255, 0, 0)');
    expect(colors).toContain('rgb(0, 255, 0)');
    expect(colors).not.toContain('rgb(112, 120, 232)');
  });
});
