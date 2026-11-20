// @vitest-environment jsdom
import { captureBlockHtml } from '@/lib/statistics/pdf-capture';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BarRows } from './bar-rows';
import { CHART_HOVER_CSS } from './chart-hover';
import { DonutRow } from './donut-row';
import { StackedRows } from './stacked-rows';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const options = [
  { label: 'Ja', count: 6, percentage: 60 },
  { label: 'Nee', count: 3, percentage: 30 },
  { label: 'Weet niet', count: 1, percentage: 10 },
];

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const tooltip = () => host.querySelector('[data-testid="chart-tooltip"]');
const hl = (el: Element) => el.getAttribute('data-hl');
const fire = (el: Element, type: string) =>
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  });

describe('chart hover', () => {
  it('hover: a bar shows label, count and percentage and dims the others', () => {
    act(() => root.render(<BarRows options={options} ariaLabel="x" />));
    const rows = host.querySelectorAll('[data-hl-part]');
    fire(rows[1], 'mouseover');
    expect(tooltip()?.textContent).toBe('Nee: 3 (30%)');
    expect(hl(rows[1])).toBe('on');
    expect(hl(rows[0])).toBe('dim');
    expect(hl(rows[2])).toBe('dim');
    fire(rows[1], 'mouseout');
    expect(tooltip()).toBeNull();
    expect(hl(rows[0])).toBeNull();
  });

  it('hover: keyboard focus on a bar does the same', () => {
    act(() => root.render(<BarRows options={options} ariaLabel="x" />));
    const row = host.querySelectorAll('[data-hl-part]')[0] as HTMLElement;
    expect(row.getAttribute('tabindex')).toBe('0');
    act(() => row.focus());
    expect(tooltip()?.textContent).toBe('Ja: 6 (60%)');
    act(() => row.blur());
    expect(tooltip()).toBeNull();
  });

  it('hover: a stacked segment shows its numbers and dims other segments', () => {
    const rows = [
      {
        label: 'Stelling',
        total: 10,
        segments: [
          { label: 'Eens', count: 7, percentage: 70 },
          { label: 'Oneens', count: 3, percentage: 30 },
        ],
      },
    ];
    act(() => root.render(<StackedRows rows={rows} number={1} />));
    const parts = host.querySelectorAll('[data-hl-part]');
    fire(parts[0], 'mouseover');
    expect(tooltip()?.textContent).toBe('Eens: 7 (70%)');
    expect(hl(parts[1])).toBe('dim');
  });

  it('hover: legend hover highlights the matching donut slice and back', () => {
    act(() =>
      root.render(<DonutRow options={options} play={false} ariaLabel="d" />)
    );
    const legend = host.querySelectorAll('li[data-hl-part]');
    fire(legend[0], 'mouseover');
    const slices = host.querySelectorAll('path[data-hl-kind="slice"]');
    expect(slices.length).toBe(3);
    expect(hl(slices[0])).toBe('on');
    expect(hl(slices[1])).toBe('dim');
    fire(legend[0], 'mouseout');
    expect(hl(slices[0])).toBeNull();
    // and the reverse: hovering a slice highlights its legend label
    fire(slices[2].closest('g') as Element, 'mouseover');
    expect(hl(legend[2])).toBe('on');
    expect(hl(legend[0])).toBe('dim');
  });

  it('hover: motion is 150ms and switched off for reduced motion', () => {
    expect(CHART_HOVER_CSS).toContain('150ms');
    expect(CHART_HOVER_CSS).toMatch(
      /prefers-reduced-motion: reduce\)[\s\S]*transition: none/
    );
  });

  it('hover: the PDF capture has no tooltip, highlight state or tab stops', async () => {
    act(() => root.render(<BarRows options={options} ariaLabel="x" />));
    fire(host.querySelectorAll('[data-hl-part]')[1], 'mouseover');
    const html = await captureBlockHtml(host);
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain('data-hl');
    expect(html).not.toContain('tabindex');
  });

  it('cursor: chart parts and thumbnails show a pointer', async () => {
    act(() => root.render(<BarRows options={options} ariaLabel="x" />));
    expect(host.querySelector('[data-hl-part]')?.className).toContain(
      'cursor-pointer'
    );
    expect(CHART_HOVER_CSS).toContain('cursor: pointer');
    const { FileLinks } = await import('./file-list');
    act(() =>
      root.render(
        <FileLinks files={[{ name: 'a.png', url: 'https://img.test/a.png' }]} />
      )
    );
    const thumb = host.querySelector('button[aria-label^="Bekijk"]');
    expect(thumb?.className).toContain('cursor-pointer');
    expect(thumb?.className).toContain('disabled:cursor-not-allowed');
  });
});
