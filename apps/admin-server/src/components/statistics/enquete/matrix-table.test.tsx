// @vitest-environment jsdom
import { contrastRatio } from '@/lib/statistics/contrast';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MatrixTable, textColorOn, tintForPercentage } from './matrix-table';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const legend = ['Goed', 'Matig'];
const rows = [
  {
    label: 'Groen',
    total: 3,
    segments: [
      { label: 'Goed', count: 2, percentage: 67 },
      { label: 'Matig', count: 1, percentage: 33 },
    ],
  },
  {
    label: 'Verkeer',
    total: 2,
    segments: [
      { label: 'Goed', count: 0, percentage: 0 },
      { label: 'Matig', count: 2, percentage: 100 },
    ],
  },
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const render = () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <MatrixTable
        title="Wat vind je?"
        legend={legend}
        rows={rows}
        number={2}
      />
    );
  });
  return host;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('MatrixTable', () => {
  it('shows the row percentage in every cell', () => {
    const el = render();
    const cells = [...el.querySelectorAll('tbody td')].map(
      (c) => c.textContent
    );
    expect(cells).toEqual(['67%', '33%', '0%', '100%']);
  });

  it('uses scope attributes and a caption', () => {
    const el = render();
    const cols = el.querySelectorAll('th[scope="col"]');
    const rowHeads = el.querySelectorAll('th[scope="row"]');
    expect(cols).toHaveLength(3);
    expect(cols[0].textContent).toBe('Onderwerp');
    expect(rowHeads).toHaveLength(2);
    expect(rowHeads[0].textContent).toBe('Groen');
    const caption = el.querySelector('caption')!;
    expect(caption.className).toContain('sr-only');
    expect(caption.textContent).toContain('Vraag 2');
    expect(caption.textContent).toBe(
      'Vraag 2: Wat vind je? Percentage per onderwerp en antwoord.'
    );
  });

  it('tints cells with a literal hex and no css variables', () => {
    const el = render();
    const cell = el.querySelector('tbody td') as HTMLElement;
    expect(cell.getAttribute('style')).not.toContain('var(');
    expect(cell.style.backgroundColor).toBe('rgb(159, 165, 240)');
    expect(tintForPercentage('#7078e8', 0)).toBe('#ffffff');
    expect(tintForPercentage('#7078e8', 100)).toBe('#7078e8');
    expect(tintForPercentage('#7078e8', 67)).toBe('#9fa5f0');
  });

  it('keeps text contrast at 4.5:1 or better for every percentage and colour', () => {
    const colors = ['#7078e8', '#d3238e', '#4aa0a4', '#9a7bcb', '#3fa22d'];
    for (const color of colors) {
      for (let pct = 0; pct <= 100; pct++) {
        const bg = tintForPercentage(color, pct);
        expect(contrastRatio(bg, textColorOn(bg))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
