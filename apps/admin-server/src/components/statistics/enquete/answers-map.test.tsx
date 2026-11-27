// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnswersMap } from './answers-map';

const loadState = vi.hoisted(() => ({ fail: false }));
vi.mock('@/components/maps/load-react-leaflet', () => ({
  loadReactLeaflet: () =>
    loadState.fail
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({
          MapContainer: ({ children }: any) => <div>{children}</div>,
          TileLayer: () => null,
          Polygon: () => null,
          Marker: ({ children, title }: any) => (
            <div data-testid="marker" data-title={title}>
              {children}
            </div>
          ),
          Tooltip: ({ children }: any) => (
            <span data-testid="tooltip">{children}</span>
          ),
          useMap: () => ({ fitBounds: () => {} }),
        }),
}));
vi.mock('@openstad-headless/leaflet-map/src/marker-icon', () => ({
  default: () => ({ options: { html: '<svg width="1" height="1"></svg>' } }),
}));
vi.mock('@/hooks/use-project', () => ({
  useProject: () => ({ data: null, isLoading: false }),
}));
vi.mock('swr', () => ({ default: () => ({ data: [], isLoading: false }) }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

// Renders and waits for the async leaflet/icon loading to settle.
async function renderMap(n: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <AnswersMap
        points={makePoints(n)}
        areaIds={[]}
        pointsTruncated={false}
        number={1}
      />
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  return container;
}

const makePoints = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ lat: 52 + i / 1000, lng: 5 }));

describe('AnswersMap pin labels', () => {
  it('labels pins with number and coordinates and has no note for 3 pins', async () => {
    const container = await renderMap(3);
    const tips = [...container.querySelectorAll('[data-testid=tooltip]')];
    expect(tips.map((t) => t.textContent)).toEqual([
      'Locatie 1 van 3: 52.00000, 5.00000',
      'Locatie 2 van 3: 52.00100, 5.00000',
      'Locatie 3 van 3: 52.00200, 5.00000',
    ]);
    expect(
      container
        .querySelector('[data-testid=marker]')
        ?.getAttribute('data-title')
    ).toBe('Locatie 1 van 3: 52.00000, 5.00000');
    expect(container.textContent).not.toContain('niet met het toetsenbord');
  });

  it('shows a keyboard note and no tooltips above 25 pins', async () => {
    const container = await renderMap(26);
    expect(container.querySelectorAll('[data-testid=marker]')).toHaveLength(26);
    expect(container.querySelectorAll('[data-testid=tooltip]')).toHaveLength(0);
    const note = container.querySelector('p.sr-only[data-pdf-exclude]');
    expect(note?.textContent).toBe(
      'Deze kaart toont 26 locaties. De pins zijn niet met het toetsenbord te bereiken; gebruik ‘Meer details’ voor alle antwoorden.'
    );
  });
});

describe('AnswersMap load failure', () => {
  it('shows a Dutch error message instead of an empty box', async () => {
    loadState.fail = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const container = await renderMap(2);
      expect(container.querySelector('[role=alert]')?.textContent).toContain(
        'De kaart kon niet worden geladen'
      );
      expect(container.querySelectorAll('[data-testid=marker]')).toHaveLength(
        0
      );
    } finally {
      loadState.fail = false;
      spy.mockRestore();
    }
  });
});
