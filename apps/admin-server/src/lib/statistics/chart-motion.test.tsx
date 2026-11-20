// @vitest-environment jsdom
import { QuestionCard } from '@/components/statistics/enquete/question-card';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHART_ANIMATION_MS,
  CHART_MOTION_CSS,
  useReducedMotion,
  waitForChartAnimations,
} from './chart-motion';
import { captureBlockHtml } from './pdf-capture';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
  (window as any).matchMedia = (globalThis as any).matchMedia;
}

function Probe() {
  return <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;
}

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  vi.unstubAllGlobals();
});

async function render() {
  const container = document.createElement('div');
  root = createRoot(container);
  await act(async () => root!.render(<Probe />));
  return container.textContent;
}

describe('chart motion', () => {
  it('lasts 600 ms with ease-out, and only when motion is allowed', () => {
    expect(CHART_ANIMATION_MS).toBe(600);
    expect(CHART_MOTION_CSS).toContain(
      '@media (prefers-reduced-motion: no-preference)'
    );
    expect(CHART_MOTION_CSS).toContain('600ms ease-out');
    // Every animation rule sits inside the no-preference block.
    const outside = CHART_MOTION_CSS.split('@keyframes')[0].split(
      '@media (prefers-reduced-motion: no-preference)'
    )[0];
    expect(outside).not.toContain('animation:');
  });

  it('reports reduced motion when the user asked for it', async () => {
    stubMatchMedia(true);
    expect(await render()).toBe('reduced');
  });

  it('reports full motion otherwise', async () => {
    stubMatchMedia(false);
    expect(await render()).toBe('full');
  });

  it('waits until a chart stops animating', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<div data-chart-animating="true"></div>';
    setTimeout(
      () =>
        el.querySelector('div')!.setAttribute('data-chart-animating', 'false'),
      80
    );
    const started = Date.now();
    await waitForChartAnimations(el);
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(el.querySelector('[data-chart-animating="true"]')).toBeNull();
  });
});

vi.mock('@/components/statistics/enquete/answers-dialog', () => ({
  AnswersDialog: () => null,
}));

class MockObserver {
  static instances: MockObserver[] = [];
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(public callback: (entries: any[]) => void) {
    MockObserver.instances.push(this);
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

const donutQuestion: any = {
  fieldKey: 'q1',
  type: 'multiplechoice',
  title: 'Hoe tevreden?',
  chart: 'donut',
  answeredCount: 3,
  options: [
    { label: 'Ja', count: 2, percentage: 67 },
    { label: 'Nee', count: 1, percentage: 33 },
  ],
};

async function renderCard() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QuestionCard
        question={donutQuestion}
        number={1}
        project="2"
        widgetId="9"
        from="2026-01-01"
        to="2026-02-01"
      />
    )
  );
  return container;
}

describe('chart motion when a card becomes visible', () => {
  afterEach(() => {
    MockObserver.instances = [];
  });

  it('visible: pending before, motion after, disconnects, never reverts', async () => {
    stubMatchMedia(false);
    vi.stubGlobal('IntersectionObserver', MockObserver);
    const container = await renderCard();
    const card = container.querySelector('.pdf-card')!;
    expect(card.classList.contains('enq-motion-pending')).toBe(true);
    expect(card.classList.contains('enq-motion')).toBe(false);
    expect(MockObserver.instances).toHaveLength(1);

    await act(async () => MockObserver.instances[0].fire(true));
    expect(card.classList.contains('enq-motion')).toBe(true);
    expect(card.classList.contains('enq-motion-pending')).toBe(false);
    expect(MockObserver.instances[0].disconnect).toHaveBeenCalled();

    await act(async () => MockObserver.instances[0].fire(false));
    expect(card.classList.contains('enq-motion')).toBe(true);
  });

  it('visible: reduced motion gets neither class', async () => {
    stubMatchMedia(true);
    vi.stubGlobal('IntersectionObserver', MockObserver);
    const container = await renderCard();
    const card = container.querySelector('.pdf-card')!;
    expect(card.classList.contains('enq-motion-pending')).toBe(false);
    expect(card.classList.contains('enq-motion')).toBe(false);
  });

  it('visible: without IntersectionObserver the card is visible at once', async () => {
    stubMatchMedia(false);
    vi.stubGlobal('IntersectionObserver', undefined);
    const container = await renderCard();
    const card = container.querySelector('.pdf-card')!;
    expect(card.classList.contains('enq-motion')).toBe(true);
    expect(card.classList.contains('enq-motion-pending')).toBe(false);
  });

  it('visible: a donut that never became visible is captured with full slices', async () => {
    stubMatchMedia(false);
    vi.stubGlobal('IntersectionObserver', MockObserver);
    const container = await renderCard();
    const card = container.querySelector('.pdf-card') as HTMLElement;
    expect(card.classList.contains('enq-motion-pending')).toBe(true);
    const html = await captureBlockHtml(card);
    expect(html).not.toContain('data-chart-animating');
    expect(html).toContain('recharts-pie-sector');
    expect(
      (html.match(/recharts-sector/g) ?? []).length
    ).toBeGreaterThanOrEqual(2);
  });
});
