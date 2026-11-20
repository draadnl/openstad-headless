// @vitest-environment jsdom
import {
  PDF_ERROR_MESSAGE,
  PDF_SERVICE_FAILED_MESSAGE,
} from '@/lib/statistics/download-pdf';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnqueteStatistics } from './enquete-statistics';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// No chart animation in these tests, so the PDF capture does not wait for one.
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

const toastError = vi.hoisted(() => vi.fn());
const captureFail = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/statistics/pdf-capture', async (importActual) => {
  const actual = await importActual<any>();
  return {
    ...actual,
    captureBlockHtml: (...args: any[]) =>
      captureFail.on
        ? Promise.reject(new Error('capture'))
        : actual.captureBlockHtml(...args),
    captureBlocksHtml: (...args: any[]) =>
      captureFail.on
        ? Promise.reject(new Error('capture'))
        : actual.captureBlocksHtml(...args),
  };
});
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }));
vi.mock('@/components/maps/load-react-leaflet', () => ({
  loadReactLeaflet: async () => ({}),
}));
vi.mock('@openstad-headless/leaflet-map/src/marker-icon', () => ({
  default: () => ({ options: { html: '' } }),
}));
vi.mock('@/hooks/use-project', () => ({
  useProject: () => ({ data: { config: {} }, isLoading: false }),
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const summary = (pdfEnabled: boolean) => ({
  total: 5,
  pdfEnabled,
  questions: [
    {
      fieldKey: 'q1',
      type: 'multiplechoice',
      title: 'Hoe tevreden bent u?',
      chart: 'donut',
      answeredCount: 3,
      options: [
        { label: 'Ja', count: 2, percentage: 67 },
        { label: 'Nee', count: 1, percentage: 33 },
      ],
    },
  ],
});

let container: HTMLDivElement;
let root: Root;
let pdfStatus = 200;
let pdfCalls: { url: string; body: any }[];
let enabled = true;

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

async function mount() {
  await act(async () => {
    root.render(
      <EnqueteStatistics project="2" from="2026-09-12" to="2026-10-12" />
    );
  });
  await settle();
}

const buttonByLabel = (label: string) =>
  container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

beforeEach(() => {
  pdfCalls = [];
  pdfStatus = 200;
  toastError.mockClear();
  captureFail.on = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('submission/widgets')) {
        return new Response(
          JSON.stringify([{ id: 172, description: 'Buurt' }])
        );
      }
      if (url.endsWith('/pdf')) {
        pdfCalls.push({ url, body: JSON.parse(String(init?.body)) });
        return new Response(pdfStatus === 200 ? 'pdf' : 'nope', {
          status: pdfStatus,
        });
      }
      return new Response(JSON.stringify(summary(enabled)));
    })
  );
  (window.URL as any).createObjectURL = vi.fn(() => 'blob:x');
  (window.URL as any).revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('PDF download links', () => {
  it('shows both links when the server says pdfEnabled', async () => {
    enabled = true;
    await mount();
    expect(buttonByLabel('Vraag 1 downloaden als PDF')?.textContent).toBe(
      'Downloaden'
    );
    expect(buttonByLabel('Alle vragen downloaden als PDF')?.textContent).toBe(
      'Alles downloaden'
    );
  });

  it('puts "Alles downloaden" at the right with the small link look', async () => {
    enabled = true;
    await mount();
    const all = buttonByLabel('Alle vragen downloaden als PDF')!;
    expect(all.className).toContain('sm:ml-auto');
    expect(all.className).toContain('shrink-0');
    expect(all.className).toContain('text-sm');
    expect(all.className).not.toContain('min-h-[44px]');
  });

  it('hides both links without pdfEnabled', async () => {
    enabled = false;
    await mount();
    expect(container.textContent).not.toContain('Downloaden');
    expect(container.textContent).not.toContain('Alles downloaden');
  });

  it('posts one block without its links to the pdf route', async () => {
    enabled = true;
    await mount();
    await act(async () => {
      buttonByLabel('Vraag 1 downloaden als PDF').click();
    });
    await settle();
    expect(pdfCalls).toHaveLength(1);
    expect(pdfCalls[0].url).toBe(
      '/api/openstad/stats/project/2/enquete/172/pdf'
    );
    expect(pdfCalls[0].body.filename).toBe('enquete-172-vraag-1.pdf');
    expect(pdfCalls[0].body.html).toContain('Hoe tevreden bent u?');
    expect(pdfCalls[0].body.html).not.toContain('Meer details');
    expect(pdfCalls[0].body.html).not.toContain('Downloaden');
  });

  it('posts header and all cards for "Alles downloaden"', async () => {
    enabled = true;
    await mount();
    await act(async () => {
      buttonByLabel('Alle vragen downloaden als PDF').click();
    });
    await settle();
    const { html, filename } = pdfCalls[0].body;
    expect(filename).toBe('enquete-172-statistieken.pdf');
    expect(html).toContain('pdf-header');
    expect(html).toContain('Van 12 september 2026 tot 12 oktober 2026');
    expect(html).toContain('5 reacties');
    expect(html).toContain('Hoe tevreden bent u?');
  });

  it('shows a toast when the PDF could not be made', async () => {
    enabled = true;
    pdfStatus = 502;
    await mount();
    await act(async () => {
      buttonByLabel('Vraag 1 downloaden als PDF').click();
    });
    await settle();
    expect(toastError).toHaveBeenCalledWith(PDF_SERVICE_FAILED_MESSAGE);
    expect(buttonByLabel('Vraag 1 downloaden als PDF').textContent).toBe(
      'Downloaden'
    );
  });

  it.each([
    ['per-question button', 'Vraag 1 downloaden als PDF'],
    ['"Alles downloaden"', 'Alle vragen downloaden als PDF'],
  ])('re-enables the %s when the capture throws', async (_n, label) => {
    enabled = true;
    await mount();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    captureFail.on = true;
    await act(async () => {
      buttonByLabel(label).click();
    });
    await settle();
    expect(toastError).toHaveBeenCalledWith(PDF_ERROR_MESSAGE);
    expect(buttonByLabel(label).disabled).toBe(false);
    expect(pdfCalls).toHaveLength(0);
  });
});
