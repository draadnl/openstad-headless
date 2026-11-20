// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuestionCard } from './question-card';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(window as any).matchMedia = () => ({
  matches: true,
  addEventListener: () => {},
  removeEventListener: () => {},
});
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
});

async function render() {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QuestionCard
        question={
          {
            fieldKey: 'q1',
            type: 'multiplechoice',
            title: 'Een hele lange vraagtitel die zelf mag afbreken',
            chart: 'open',
            answeredCount: 0,
            latest: [],
          } as any
        }
        number={1}
        project="2"
        widgetId="175"
        from="2026-09-12"
        to="2026-10-12"
        pdfEnabled
      />
    )
  );
  return container;
}

describe('QuestionCard head', () => {
  it('keeps title and links on one row from sm', async () => {
    const c = await render();
    const head = c.querySelector('.pdf-card-head')!;
    expect(head.className).toContain('sm:flex-nowrap');
    expect(head.className).toContain('sm:justify-between');
    const title = c.querySelector('.pdf-card-title')!;
    expect(title.className).toContain('sm:flex-1');
    expect(title.textContent).toContain('1. Een hele lange vraagtitel');
  });

  it('keeps the link group out of the PDF and unshrinkable', async () => {
    const c = await render();
    const group = c.querySelector('[data-pdf-exclude]')!;
    expect(group.className).toContain('shrink-0');
    expect(group.className).toContain('whitespace-nowrap');
    expect(group.textContent).toContain('Downloaden');
    expect(group.textContent).toContain('Meer details');
  });
});
