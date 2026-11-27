// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BarRows } from './bar-rows';
import { DonutRow } from './donut-row';
import { RankingRows } from './ranking-rows';
import { StackedRows } from './stacked-rows';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <svg>{children}</svg>,
  Cell: () => null,
  Pie: () => null,
}));

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

describe('narrow-card layout (375px)', () => {
  it('DonutRow wraps the donut under the legend instead of overflowing', () => {
    const el = render(
      <DonutRow options={options} play={false} ariaLabel="Donut" />
    );
    const row = el.querySelector('.pdf-donut-row') as HTMLElement;
    const chart = el.querySelector('.pdf-donut-chart') as HTMLElement;
    expect(row.className).toContain('flex-wrap');
    expect(chart.className).toContain('basis-[240px]');
  });

  it('BarRows no longer pins the label column to a fixed 300px and truncates long labels', () => {
    const el = render(
      <BarRows
        options={[
          { label: 'Een erg lang antwoord', count: 2, percentage: 100 },
        ]}
        ariaLabel="Bars"
      />
    );
    const label = el.querySelector('.pdf-bar-label') as HTMLElement;
    // jsdom drops min(); a fixed pixel width would be kept, so it must be absent.
    expect(label.style.width).not.toBe('300px');
    const text = label.querySelector('span.truncate') as HTMLElement;
    expect(text.getAttribute('title')).toBe('Een erg lang antwoord');
  });

  it('RankingRows no longer pins the label column to a fixed 300px and truncates long labels', () => {
    const el = render(
      <RankingRows
        number={1}
        options={[
          {
            label: 'Een erg lang antwoord',
            count: 2,
            percentage: 100,
            average: 1.5,
          },
        ]}
      />
    );
    const label = el.querySelector('.pdf-bar-label') as HTMLElement;
    expect(label.style.width).not.toBe('300px');
    const text = label.querySelector('span.truncate') as HTMLElement;
    expect(text.getAttribute('title')).toBe('Een erg lang antwoord');
  });

  it('StackedRows no longer pins the label column to a fixed 300px', () => {
    const el = render(
      <StackedRows
        number={1}
        rows={[
          {
            label: 'Een erg lang antwoord',
            total: 2,
            segments: [{ label: 'Ja', count: 2, percentage: 100 }],
          },
        ]}
      />
    );
    const label = el.querySelector('.pdf-bar-label') as HTMLElement;
    expect(label.style.width).not.toBe('300px');
  });
});
