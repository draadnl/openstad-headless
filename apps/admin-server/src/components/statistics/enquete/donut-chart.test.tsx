// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DonutChart } from './donut-chart';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const pieProps = vi.hoisted(() => ({ last: null as any }));
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <svg>{children}</svg>,
  Cell: () => null,
  Pie: (props: any) => {
    pieProps.last = props;
    return null;
  },
}));

const options = [
  { label: 'Ja', count: 2, percentage: 67 },
  { label: 'Nee', count: 1, percentage: 33 },
];

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function render(reduced: boolean, play = true) {
  (window as any).matchMedia = () => ({
    matches: reduced,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <DonutChart options={options as any} ariaLabel="x" play={play} />
    )
  );
  return container;
}

describe('DonutChart animation', () => {
  it('animates in 600 ms and marks itself while it runs', async () => {
    const container = await render(false);
    expect(pieProps.last.isAnimationActive).toBe(true);
    expect(pieProps.last.animationDuration).toBe(600);
    expect(pieProps.last.animationEasing).toBe('ease-out');
    expect(
      container.querySelector('[data-chart-animating="true"]')
    ).not.toBeNull();

    await act(async () => pieProps.last.onAnimationEnd());
    expect(container.querySelector('[data-chart-animating="true"]')).toBeNull();
  });

  it('does not animate with prefers-reduced-motion', async () => {
    const container = await render(true);
    expect(pieProps.last.isAnimationActive).toBe(false);
    expect(container.querySelector('[data-chart-animating="true"]')).toBeNull();
  });

  it('visible: shows final sizes without animation until play is true', async () => {
    const container = await render(false, false);
    expect(pieProps.last.isAnimationActive).toBe(false);
    expect(container.querySelector('[data-chart-animating="true"]')).toBeNull();
    await act(async () =>
      root!.render(<DonutChart options={options as any} ariaLabel="x" play />)
    );
    expect(pieProps.last.isAnimationActive).toBe(true);
  });
});

describe('DonutChart percentage labels', () => {
  async function renderWith(opts: any[], play = true) {
    (window as any).matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const container = document.createElement('div');
    root = createRoot(container);
    await act(async () =>
      root!.render(<DonutChart options={opts} ariaLabel="x" play={play} />)
    );
    return container;
  }
  const texts = (c: HTMLElement) =>
    Array.from(c.querySelectorAll('.pdf-donut text')).map((t) => t.textContent);

  it('draws a whole-number percentage per slice', async () => {
    const c = await renderWith([
      { label: 'a', count: 21, percentage: 21 },
      { label: 'b', count: 45, percentage: 45 },
      { label: 'c', count: 20, percentage: 20 },
      { label: 'd', count: 10, percentage: 10 },
      { label: 'e', count: 4, percentage: 4 },
    ]);
    expect(texts(c)).toEqual(['21%', '45%', '20%', '10%', '4%']);
  });

  it('hides a tiny slice', async () => {
    const c = await renderWith([
      { label: 'a', count: 98, percentage: 98 },
      { label: 'b', count: 2, percentage: 2 },
    ]);
    expect(texts(c)).toEqual(['98%']);
  });

  it('also draws labels when play is false', async () => {
    const c = await renderWith(options as any, false);
    expect(texts(c)).toEqual(['67%', '33%']);
  });
});
