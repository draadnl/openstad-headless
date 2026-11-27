// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubmissionsAreaChart } from './submissions-area-chart';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Records the Area props so the tests can read isAnimationActive.
const areaProps = vi.hoisted(() => ({ last: null as any }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <svg>{children}</svg>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Area: (props: any) => {
    areaProps.last = props;
    return null;
  },
}));

class MockObserver {
  static instances: MockObserver[] = [];
  callback: (entries: { isIntersecting: boolean }[]) => void;
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(callback: any) {
    this.callback = callback;
    MockObserver.instances.push(this);
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

const data = [{ date: '1 jan', counted: 3 }];

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  MockObserver.instances = [];
  vi.unstubAllGlobals();
});

async function render(reduced: boolean) {
  (window as any).matchMedia = () => ({
    matches: reduced,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('IntersectionObserver', MockObserver);
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root!.render(<SubmissionsAreaChart data={data} />));
  return container;
}

describe('SubmissionsAreaChart animation', () => {
  it('does not animate while out of view', async () => {
    await render(false);
    expect(areaProps.last.isAnimationActive).toBe(false);
  });

  it('animates once the observer reports it intersecting', async () => {
    await render(false);
    await act(async () => MockObserver.instances[0].fire(true));
    expect(areaProps.last.isAnimationActive).toBe(true);
    expect(areaProps.last.animationDuration).toBe(600);
    expect(areaProps.last.animationEasing).toBe('ease-out');
  });

  it('does not animate with reduced motion, even in view', async () => {
    await render(true);
    await act(async () => MockObserver.instances[0]?.fire(true));
    expect(areaProps.last.isAnimationActive).toBe(false);
  });
});
