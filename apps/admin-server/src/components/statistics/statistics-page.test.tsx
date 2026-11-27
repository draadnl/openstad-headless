// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Statistics from '../../pages/projects/[project]/statistics';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('next/router', () => ({
  useRouter: () => ({ query: { project: '2' } }),
}));
vi.mock('@/components/ui/page-layout', () => ({
  PageLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/statistics/enquete/enquete-statistics', () => ({
  EnqueteStatistics: () => null,
}));

const overview = [
  { key: 'resourceTotal', description: '', result: [{ counted: 1234 }] },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => overview })
  );
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

// The Cijfers count-up starts from 0 once the stat card is visible (jsdom has no IntersectionObserver, so at once).
// The count-up runs on fake timers (frames + performance.now), so the test does not depend on real time.
describe('statistics page (Cijfers)', () => {
  it('still shows the final number after the count-up', async () => {
    await act(async () => root.render(<Statistics />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(container.textContent).toContain('1234');
  });
});
