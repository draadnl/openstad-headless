// @vitest-environment jsdom
import { PIN_SIZE } from '@/lib/statistics/enquete-map-helpers';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnqueteStatistics } from './enquete-statistics';

// React only ships act() outside production; a shell with NODE_ENV=production would break it.
vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Fake map pieces, so we can count markers and shapes without real Leaflet.
const fitBoundsCalls: any[][] = vi.hoisted(() => []);

vi.mock('@/components/maps/load-react-leaflet', () => ({
  loadReactLeaflet: async () => ({
    MapContainer: ({ children }: any) => (
      <div data-testid="map">{children}</div>
    ),
    TileLayer: () => null,
    Marker: () => <i data-testid="marker" />,
    Polygon: ({ pathOptions, positions }: any) => (
      <i
        data-testid="polygon"
        data-style={JSON.stringify(pathOptions)}
        data-positions={JSON.stringify(positions)}
      />
    ),
    useMap: () => ({
      fitBounds: (...args: any[]) => fitBoundsCalls.push(args),
    }),
  }),
}));
vi.mock('@openstad-headless/leaflet-map/src/marker-icon', () => ({
  default: () => ({
    options: { html: '<svg width="32" height="40"></svg>' },
  }),
}));
vi.mock('@/hooks/use-project', () => ({
  useProject: () => ({
    data: { config: { map: { areaId: '0' } } },
    isLoading: false,
  }),
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const SUMMARY = {
  total: 127,
  questions: [
    {
      fieldKey: 'q1',
      type: 'multiplechoice',
      title: 'Hoe tevreden bent u?',
      chart: 'donut',
      answeredCount: 3,
      options: [
        { label: 'Heel tevreden', count: 2, percentage: 67 },
        { label: 'Tevreden', count: 1, percentage: 33 },
      ],
    },
  ],
};

let container: HTMLDivElement;
let root: Root;
let routes: Record<string, () => Response>;
let calls: string[];

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

async function mount() {
  await act(async () => {
    root.render(
      <EnqueteStatistics project="2" from="2026-09-12" to="2026-10-12" />
    );
  });
  await settle();
}

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const key = Object.keys(routes).find((k) => url.includes(k));
      if (!key) throw new Error(`unmocked ${url}`);
      return routes[key]();
    })
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('EnqueteStatistics', () => {
  it('shows an empty state when the project has no survey widgets', async () => {
    routes['submission/widgets'] = json([]);
    await mount();
    expect(container.textContent).toContain('geen enquêtes');
  });

  it('shows count, question title and legend for the first widget', async () => {
    routes['submission/widgets'] = json([
      { id: 172, description: 'Buurt' },
      { id: 173, description: 'Andere' },
    ]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();

    expect(container.textContent).toContain('Bekijk gegevens van:');
    expect(container.textContent).toContain('Widget 172 - Buurt');
    expect(container.textContent).toContain('127 reacties');
    expect(container.textContent).toContain('1. Hoe tevreden bent u?');
    expect(container.textContent).toContain('Heel tevreden');
    expect(container.textContent).toContain('Meer details');
    // Without pdfEnabled in the response the download links stay hidden.
    expect(container.textContent).not.toContain('Downloaden');
    expect(container.querySelector('[role="img"]')).not.toBeNull();
  });

  it('lets the picker row, select and outer padding shrink on narrow screens', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();
    const trigger = container.querySelector('#enquete-widget-select')!;
    const row = trigger.parentElement!;
    expect(row.className).toContain('flex-wrap');
    expect(trigger.className).toContain('w-full');
    expect(trigger.className).toContain('min-w-0');
    expect(trigger.className).toContain('lg:flex-1');
    expect(trigger.className).not.toContain('sm:w-[368px]');
    expect(row.className).toContain('lg:flex-nowrap');
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'p-4 sm:p-8'
    );
  });

  it('keeps the question card header on one row from sm and breaks long titles', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();
    const card = container.querySelector('.pdf-card')!;
    const title = card.querySelector('.pdf-card-title')!;
    expect(card.className).toContain('min-w-0');
    expect(card.className).toContain('p-4 sm:p-5');
    expect(title.className).toContain('break-words');
    expect(title.className).toContain('min-w-0');
    expect(title.parentElement!.className).toContain('sm:flex-nowrap');
  });

  it('sends the date range to the server', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();
    expect(calls.some((u) => u.includes('from=2026-09-12&to=2026-10-12'))).toBe(
      true
    );
  });

  it('shows an empty state for 0 submissions in the period', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({ total: 0, questions: [] });
    await mount();
    expect(container.textContent).toContain('0 reacties');
    expect(container.textContent).toContain('Geen reacties');
  });

  it('shows a message when the widget was deleted (404)', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({}, 404);
    await mount();
    expect(container.textContent).toContain('bestaat niet meer');
  });

  it('handles a question with zero answers without crashing', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({
      total: 5,
      questions: [
        {
          ...SUMMARY.questions[0],
          answeredCount: 0,
          options: [{ label: 'Ja', count: 0, percentage: 0 }],
        },
      ],
    });
    await mount();
    expect(container.textContent).toContain('Nog geen antwoorden');
  });
});

describe('EnqueteStatistics: other question blocks', () => {
  const load = async (questions: any[], total = 30) => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({ total, questions });
    await mount();
  };

  it('draws a bar row per option with a matching tick axis', async () => {
    await load([
      {
        fieldKey: 'q3',
        type: 'multiple',
        title: 'Top 3',
        chart: 'bar',
        answeredCount: 3,
        options: [
          { label: 'Meer groen', count: 112, percentage: 90 },
          { label: 'Anders', count: 15, percentage: 12 },
        ],
      },
    ]);
    expect(container.textContent).toContain('Meer groen');
    expect(container.textContent).toContain('112');
    // axis 0..120 in steps of 20
    expect(container.textContent).toContain('120');
    expect(container.textContent).toContain('100');
    expect(container.querySelector('[role="img"]')).not.toBeNull();
  });

  it('renders a scale question as bar rows', async () => {
    await load([
      {
        fieldKey: 'q5',
        type: 'scale',
        title: 'Cijfer',
        chart: 'bar',
        answeredCount: 2,
        options: [1, 2, 3, 4, 5].map((n) => ({
          label: String(n),
          count: n === 3 ? 2 : 0,
          percentage: n === 3 ? 100 : 0,
        })),
      },
    ]);
    expect(container.textContent).toContain('1. Cijfer');
  });

  it('shows the answer count and latest answers for an open question', async () => {
    await load([
      {
        fieldKey: 'q4',
        type: 'open',
        title: 'Wat hoop je?',
        chart: 'open',
        answeredCount: 30,
        latest: ['Hoe bereik ik bewoners', 'tweede'],
      },
    ]);
    expect(container.textContent).toContain('30');
    expect(container.textContent).toContain('Antwoorden');
    expect(container.textContent).toContain('Meest recente antwoorden');
    expect(container.textContent).toContain('"Hoe bereik ik bewoners"');
  });

  it('shows only the number for a personal-data open question', async () => {
    await load([
      {
        fieldKey: 'q6',
        type: 'open',
        title: 'E-mail',
        chart: 'open',
        answeredCount: 12,
      },
    ]);
    expect(container.textContent).toContain('12');
    expect(container.textContent).not.toContain('Meest recente antwoorden');
  });

  it('files upload: links a file with a url, shows a file without url as plain text', async () => {
    await load([
      {
        fieldKey: 'q11',
        type: 'imageUpload',
        title: 'Foto',
        chart: 'files',
        answeredCount: 2,
        fileCount: 2,
        preview: [
          { name: 'a.png', url: 'https://images.example.com/a.png' },
          { name: 'geheim.pdf', url: null },
        ],
      },
    ]);
    expect(container.textContent).toContain('2 antwoorden · 2 bestanden');
    // Images open in the viewer (a button), not as a link.
    expect(
      container.querySelector('a[href="https://images.example.com/a.png"]')
    ).toBeNull();
    expect(
      container.querySelector('button[aria-label="Bekijk a.png"]')
    ).not.toBeNull();
    const links = Array.from(container.querySelectorAll('a')).map(
      (a) => a.textContent
    );
    expect(links).not.toContain('geheim.pdf');
    expect(container.textContent).toContain('geheim.pdf');
  });

  describe('map question', () => {
    const mapQuestion = (extra: any = {}) => ({
      fieldKey: 'q4',
      type: 'map',
      title: 'Waar?',
      chart: 'map',
      answeredCount: 2,
      points: [
        { lat: 52.1, lng: 5.1 },
        { lat: 52.2, lng: 5.2 },
      ],
      areaIds: [5],
      pointsTruncated: false,
      ...extra,
    });
    const area = {
      polygon: [
        [
          { lat: 52, lng: 5 },
          { lat: 52.5, lng: 5 },
          { lat: 52.5, lng: 5.5 },
        ],
      ],
    };

    it('draws a marker per pin, a cutout and an outline', async () => {
      routes['/api/area/5'] = json(area);
      await load([mapQuestion()]);
      expect(container.querySelectorAll('[data-testid="marker"]')).toHaveLength(
        2
      );
      const styles = Array.from(
        container.querySelectorAll('[data-testid="polygon"]')
      ).map((el) => JSON.parse(el.getAttribute('data-style') || '{}'));
      expect(styles).toHaveLength(2);
      expect(styles[0]).toMatchObject({ stroke: false, fillOpacity: 0.15 });
      expect(styles[1]).toMatchObject({
        color: '#000',
        weight: 2,
        fill: false,
      });
    });

    it('fits the map with room above for the pin head', async () => {
      routes['/api/area/5'] = json(area);
      fitBoundsCalls.length = 0;
      await load([mapQuestion()]);
      expect(fitBoundsCalls.length).toBeGreaterThan(0);
      const options = fitBoundsCalls[0][1];
      expect(options.paddingTopLeft[1]).toBe(PIN_SIZE.height + 4);
      expect(options.paddingBottomRight).toEqual([8, 8]);
      const wrapper = container.querySelector('[role="group"]');
      expect(wrapper?.className).not.toMatch(/\brounded\b/);
    });

    it('cuts the area ring out of a world box', async () => {
      routes['/api/area/5'] = json(area);
      await load([mapQuestion()]);
      const cutout = container.querySelector('[data-testid="polygon"]');
      const rings = JSON.parse(cutout?.getAttribute('data-positions') || '[]');
      expect(rings).toHaveLength(2);
      expect(rings[0]).toEqual([
        [-90, -180],
        [-90, 180],
        [90, 180],
        [90, -180],
      ]);
      expect(rings[1][0]).toEqual([52, 5]);
      expect(
        JSON.parse(cutout?.getAttribute('data-style') || '{}').fillOpacity
      ).toBe(0.15);
    });

    it('has a group label, hidden text and no visible text under the map', async () => {
      routes['/api/area/5'] = json(area);
      await load([mapQuestion()]);
      const group = container.querySelector('[role="group"]');
      expect(group?.getAttribute('aria-label')).toBe(
        'Kaart met 2 gekozen locaties bij vraag 1'
      );
      expect(group?.querySelector('.sr-only')?.textContent).toBe('2 locaties');
      expect(container.textContent).not.toContain('Eerste 2.000');
      expect(container.textContent).not.toContain('antwoorden');
    });

    it('shows the truncation line only when truncated', async () => {
      routes['/api/area/5'] = json(area);
      await load([mapQuestion({ pointsTruncated: true })]);
      expect(container.textContent).toContain('Eerste 2.000 locaties getoond');
    });

    it('shows the map plus the empty message for 0 points', async () => {
      await load([mapQuestion({ answeredCount: 0, points: [], areaIds: [] })]);
      expect(container.querySelector('[data-testid="map"]')).not.toBeNull();
      expect(container.querySelectorAll('[data-testid="marker"]')).toHaveLength(
        0
      );
      expect(container.textContent).toContain('Nog geen antwoorden');
    });
  });

  it('survives a bar question with zero answers', async () => {
    await load([
      {
        fieldKey: 'q8',
        type: 'multiple',
        title: 'Leeg',
        chart: 'bar',
        answeredCount: 0,
        options: [{ label: 'A', count: 0, percentage: 0 }],
      },
    ]);
    expect(container.textContent).toContain('Nog geen antwoorden');
  });
});

describe('Meer details dialog', () => {
  const question = {
    fieldKey: 'q1',
    type: 'multiplechoice',
    title: 'Hoe tevreden bent u?',
    chart: 'donut',
    answeredCount: 3,
    options: [
      { label: 'Heel tevreden', count: 2, percentage: 67 },
      { label: 'Tevreden', count: 1, percentage: 33 },
    ],
  };

  const page = (answers: string[], total: number, pageNo: number) => ({
    total,
    page: pageNo,
    pageSize: 2,
    rows: answers.map((answer, i) => ({
      createdAt: `2026-10-0${i + 1}T10:30:00.000Z`,
      answer,
    })),
  });

  const clickDetails = async () => {
    const button = container.querySelector(
      'button[aria-label="Meer details over vraag 1"]'
    ) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    await settle();
  };

  it('opens with the title, intro and the first page of answers', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Heel tevreden', 'Tevreden'], 3, 1));
    await mount();
    await clickDetails();

    const text = document.body.textContent ?? '';
    expect(text).toContain('Hieronder zie je alle gegeven antwoorden');
    expect(text).toContain('Datum');
    expect(text).toContain('Tijd');
    expect(text).toContain('Heel tevreden');
    // highest number on top when newest first
    const numbers = Array.from(
      document.body.querySelectorAll('tbody tr td:first-child')
    ).map((td) => td.textContent);
    expect(numbers).toEqual(['3', '2']);
    expect(
      calls.some((u) => u.includes('/details') && u.includes('fieldKey=q1'))
    ).toBe(true);
  });

  it('loads the next page with the "Meer laden" button', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Heel tevreden', 'Tevreden'], 3, 1));
    await mount();
    await clickDetails();

    routes['/details'] = json(page(['Tevreden'], 3, 2));
    const more = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Meer laden'
    ) as HTMLButtonElement;
    expect(more).toBeTruthy();
    await act(async () => {
      more.click();
    });
    await settle();

    expect(document.body.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(calls.some((u) => u.includes('page=2'))).toBe(true);
    expect(
      Array.from(document.body.querySelectorAll('button')).some(
        (b) => b.textContent === 'Meer laden'
      )
    ).toBe(false);
  });

  it('shows the numbered title, a visible close button and a sticky table header', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Tevreden'], 1, 1));
    await mount();
    await clickDetails();
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const title = dialog.querySelector('h2');
    expect(title?.textContent?.startsWith('1. ')).toBe(true);
    const close = dialog.querySelector(
      'button[aria-label="Sluiten"]'
    ) as HTMLElement;
    expect(close).toBeTruthy();
    expect(close.className).not.toContain('sr-only');
    const ths = Array.from(dialog.querySelectorAll('th'));
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((th) => expect(th.className).toContain('sticky'));
  });

  it('wraps a long dialog title instead of truncating it', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Tevreden'], 1, 1));
    await mount();
    await clickDetails();
    const title = document.body.querySelector(
      '[role="dialog"] h2'
    ) as HTMLElement;
    expect(title.className).not.toContain('truncate');
    expect(title.className).toContain('font-bold');
    // right padding keeps room for the close control
    expect(title.parentElement!.className).toContain('pr-12');
    expect(title.textContent).toBe('1. Hoe tevreden bent u?');
  });

  it('styles the details dialog like the design', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Tevreden'], 1, 1));
    await mount();
    await clickDetails();
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    expect(dialog.querySelector('h2')!.className).toContain('font-bold');
    expect(dialog.querySelector('#enquete-answers-intro')!.className).toContain(
      'text-[#64748b]'
    );
    const th = dialog.querySelector('th')!;
    expect(th.className).toContain('border-b');
    expect(th.className).not.toContain('bg-[#f1f1f4]');
  });

  it('closes the details dialog with Escape', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Tevreden'], 1, 1));
    await mount();
    await clickDetails();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      document.body
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
    });
    await settle();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('lets the scroll box fill the larger dialog with a thin scrollbar', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({ total: 3, questions: [question] });
    routes['/details'] = json(page(['Tevreden'], 1, 1));
    await mount();
    await clickDetails();
    const scroll = document.body.querySelector(
      '[data-testid="answers-scroll"]'
    ) as HTMLElement;
    expect(scroll.className).toContain('overflow-y-auto');
    expect(scroll.className).toContain('flex-1');
    expect(scroll.className).not.toContain('h-[411px]');
    expect(scroll.className).toContain('[scrollbar-width:thin]');
    expect(document.body.querySelector('th')!.className).toContain('h-[33px]');
    expect(document.body.querySelector('tbody tr')!.className).toContain('h-9');
    expect(
      document.body.querySelector('[role="dialog"]')!.className
    ).not.toContain('h-[520px]');
  });

  it('hides Meer details for personal-data questions', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({
      total: 3,
      questions: [
        {
          fieldKey: 'mail',
          type: 'open',
          title: 'E-mail',
          chart: 'open',
          answeredCount: 3,
          personalData: true,
        },
      ],
    });
    await mount();
    expect(container.textContent).not.toContain('Meer details');
  });
});

describe('design layout', () => {
  it('limits the survey panel, cards and select to the design width', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();

    const select = container.querySelector('#enquete-widget-select')!;
    expect(select.className).toContain('lg:max-w-[460px]');
    expect(select.className).not.toContain('w-[368px]');
    expect(select.className).toContain('h-9');
    expect(select.className).toContain('max-w-full');
    expect(select.closest('div')!.className).toContain('max-w-[720px]');

    const card = container.querySelector(
      '[class*="max-w-[720px]"][class*="rounded-xl"]'
    );
    expect(card).not.toBeNull();
    expect(card!.className).toContain('w-full');
    expect(card!.className).not.toContain('max-w-[880px]');
  });

  it('keeps the widget select text on one left-aligned line', async () => {
    routes['submission/widgets'] = json([
      { id: 172, description: 'Enquête buurttevredenheid Oosterhout (demo)' },
    ]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();

    const trigger = container.querySelector('#enquete-widget-select')!;
    const wrapper = trigger.querySelector('span.truncate')!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toContain('text-left');
    expect(trigger.className).toContain('text-left');
    expect(trigger.getAttribute('title')).toBe(
      'Widget 172 - Enquête buurttevredenheid Oosterhout (demo)'
    );
  });
});

describe('legend layout', () => {
  it('puts label and count in separate table cells', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(SUMMARY);
    await mount();

    const item = container.querySelector('.pdf-legend-item')!;
    expect(item.className).toContain('table-row');
    const label = item.querySelector('.pdf-legend-label')!;
    const count = item.querySelector('.pdf-legend-count')!;
    expect(label.textContent).toBe('Heel tevreden');
    expect(count.textContent).toBe('2');
    expect(label.className).toContain('table-cell');
    expect(count.className).toContain('table-cell');
    expect(item.querySelector('.pdf-legend-dot-cell .pdf-dot')).not.toBeNull();
  });
});

describe('open answers layout', () => {
  it('keeps one line per answer with both quote marks next to the text', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({
      total: 5,
      questions: [
        {
          fieldKey: 'q9',
          type: 'open',
          title: 'Wat hoop je?',
          chart: 'open',
          answeredCount: 5,
          latest: ['een heel lang antwoord dat wordt afgekapt'],
        },
      ],
    });
    await mount();

    const text = container.querySelector('.pdf-open-quote-text')!;
    expect(text.textContent).toBe('een heel lang antwoord dat wordt afgekapt');
    expect(text.className).toContain('whitespace-nowrap');
    expect(text.className).not.toContain('flex-1');
    const row = text.parentElement!;
    expect(row.className).toContain('inline-flex');
    expect(row.children).toHaveLength(3);
    expect(row.querySelectorAll('.pdf-open-quote-mark')).toHaveLength(2);
    expect(row.children[0].textContent).toBe('"');
    expect(row.children[2].textContent).toBe('"');
  });
});

describe('dilemma key', () => {
  const seg = (label: string, count: number, percentage: number) => ({
    label,
    count,
    percentage,
  });
  const summary = {
    total: 10,
    questions: [
      {
        fieldKey: 'q10',
        type: 'dilemma',
        title: 'Dilemma',
        chart: 'stacked',
        answeredCount: 10,
        legend: ['A', 'B'],
        rows: [
          {
            label: 'Meer groen',
            total: 10,
            segments: [seg('A', 6, 60), seg('B', 4, 40)],
            sideLabels: ['Meer groen', 'Meer parkeren'],
          },
        ],
      },
      {
        fieldKey: 'q7',
        type: 'matrix',
        title: 'Matrix',
        chart: 'stacked',
        answeredCount: 10,
        legend: ['Ja', 'Nee'],
        rows: [
          {
            label: 'Rij 1',
            total: 10,
            segments: [seg('Ja', 5, 50), seg('Nee', 5, 50)],
          },
        ],
      },
    ],
  };

  it('shows the A label once per dilemma row with two coloured dots', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(summary);
    await mount();

    const key = container.querySelector('.pdf-stacked-key')!;
    expect(key.querySelectorAll('.pdf-dot')).toHaveLength(2);
    const visible = Array.from(
      container.querySelectorAll('.pdf-stacked-row .pdf-bar-label')
    )[0].textContent!;
    expect(visible.split('Meer groen')).toHaveLength(2);
    expect(visible).toContain('Meer parkeren');
  });

  it('stacks A above B on every dilemma row', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(summary);
    await mount();

    const keys = Array.from(container.querySelectorAll('.pdf-stacked-key'));
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((key) => {
      expect(key.classList.contains('flex-col')).toBe(true);
      expect(key.classList.contains('flex-wrap')).toBe(false);
      const items = key.querySelectorAll('.pdf-stacked-key-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toBe('Meer groen');
      expect(items[1].textContent).toBe('Meer parkeren');
      expect(
        key.closest('.pdf-stacked-row')!.classList.contains('items-center')
      ).toBe(true);
    });
  });

  it('keeps the matrix legend and plain row label', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json(summary);
    await mount();

    const rows = container.querySelectorAll('.pdf-stacked-row');
    expect(rows[1].querySelector('.pdf-stacked-key')).toBeNull();
    expect(rows[1].querySelector('.pdf-bar-label')!.textContent).toBe('Rij 1');
    expect(container.querySelectorAll('.pdf-stacked-legend')).toHaveLength(2);
  });
});

describe('dilemma skipped key', () => {
  const seg = (
    label: string,
    count: number,
    percentage: number,
    skipped = false
  ) => ({ label, count, percentage, ...(skipped ? { skipped: true } : {}) });
  const dilemma = (skippedCount: number) => ({
    fieldKey: 'q10',
    type: 'dilemma',
    title: 'Dilemma',
    chart: 'stacked',
    answeredCount: 10,
    rows: [
      {
        label: 'Meer groen',
        total: 10,
        segments: [
          seg('Meer groen', 6, 60),
          seg('Meer parkeren', 4 - skippedCount, 40 - skippedCount * 10),
          seg('Overgeslagen', skippedCount, skippedCount * 10, true),
        ],
        sideLabels: ['Meer groen', 'Meer parkeren'],
      },
    ],
  });
  const show = async (questions: any[]) => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({ total: 10, questions });
    await mount();
  };

  it('shows one grey "Overgeslagen" key when answers were skipped', async () => {
    await show([dilemma(2)]);
    const items = container.querySelectorAll('.pdf-stacked-legend-item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('Overgeslagen');
    const dot = items[0].querySelector('.pdf-dot') as HTMLElement;
    expect(dot.style.backgroundColor).not.toBe('');
  });

  it('shows no key when nothing was skipped', async () => {
    await show([dilemma(0)]);
    expect(container.querySelector('.pdf-stacked-legend')).toBeNull();
  });

  it('keeps the swipe legend at three items and the matrix legend as it was', async () => {
    await show([
      {
        fieldKey: 'q6',
        type: 'swipe',
        title: 'Swipe',
        chart: 'stacked',
        answeredCount: 10,
        legend: ['Eens', 'Oneens', 'Overgeslagen'],
        rows: [
          {
            label: 'Kaart 1',
            total: 10,
            segments: [
              seg('Eens', 5, 50),
              seg('Oneens', 3, 30),
              seg('Overgeslagen', 2, 20, true),
            ],
          },
        ],
      },
      {
        fieldKey: 'q7',
        type: 'matrix',
        title: 'Matrix',
        chart: 'stacked',
        answeredCount: 10,
        legend: ['Ja', 'Nee'],
        rows: [
          {
            label: 'Rij 1',
            total: 10,
            segments: [seg('Ja', 5, 50), seg('Nee', 5, 50)],
          },
        ],
      },
    ]);
    const legends = container.querySelectorAll('.pdf-stacked-legend');
    expect(legends).toHaveLength(2);
    expect(
      Array.from(legends[0].querySelectorAll('li')).map((li) => li.textContent)
    ).toEqual(['Eens', 'Oneens', 'Overgeslagen']);
    expect(legends[1].querySelectorAll('li')).toHaveLength(2);
  });
});

describe('ranking axis', () => {
  it('shows grid lines and an axis with places 1..n', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172'] = json({
      total: 10,
      questions: [
        {
          fieldKey: 'q8',
          type: 'sort',
          title: 'Sorteer',
          chart: 'ranking',
          answeredCount: 10,
          options: [
            { label: 'Groen', count: 10, percentage: 100, average: 1.5 },
            { label: 'Parkeren', count: 10, percentage: 100, average: 2.5 },
            { label: 'Verlichting', count: 10, percentage: 100, average: 3 },
          ],
        },
      ],
    });
    await mount();

    expect(container.querySelectorAll('.pdf-bar-gridline')).toHaveLength(9);
    const ticks = Array.from(container.querySelectorAll('.pdf-bar-tick'));
    expect(ticks.map((t) => t.textContent)).toEqual(['1', '2', '3']);
    expect(container.querySelector('.pdf-bar-axis')).not.toBeNull();
  });
});

describe('pdf file list', () => {
  const filesQuestion = {
    total: 10,
    questions: [
      {
        fieldKey: 'q11',
        type: 'imageUpload',
        title: 'Upload',
        chart: 'files',
        answeredCount: 10,
        fileCount: 7,
        preview: [
          { name: 'a.pdf', url: 'https://x/a.pdf' },
          { name: 'b.pdf', url: 'https://x/b.pdf' },
        ],
      },
    ],
  };
  const open = async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json(filesQuestion);
    routes['/details'] = json({ total: 0, page: 1, pageSize: 2, rows: [] });
    await mount();
  };

  it('marks the list, the rows and the file names for the PDF', async () => {
    await open();
    expect(container.querySelector('ul.pdf-files-list')).not.toBeNull();
    expect(container.querySelectorAll('li.pdf-files-item')).toHaveLength(2);
    const name = container.querySelector('.pdf-file-name') as HTMLElement;
    expect(name.tagName).toBe('SPAN');
    expect(name.closest('a')).not.toBeNull();
  });

  it('keeps the "en N meer" line in the PDF but not the button', async () => {
    await open();
    const more = container.querySelector('.pdf-files-more') as HTMLElement;
    expect(more.textContent).toContain('en 5 meer');
    expect(more.hasAttribute('data-pdf-exclude')).toBe(false);
    const button = more.querySelector('button') as HTMLButtonElement;
    expect(button.closest('[data-pdf-exclude]')).not.toBeNull();
  });
});

describe('upload focus ring', () => {
  const setup = async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({
      total: 10,
      questions: [
        {
          fieldKey: 'q11',
          type: 'imageUpload',
          title: 'Upload',
          chart: 'files',
          answeredCount: 10,
          fileCount: 7,
          preview: [{ name: 'a.pdf', url: 'https://x/a.pdf' }],
        },
      ],
    });
    routes['/details'] = json({
      total: 1,
      page: 1,
      pageSize: 2,
      rows: [
        {
          createdAt: '2026-10-01T10:30:00.000Z',
          answer: 'x',
          files: [{ name: 'dialog.pdf', url: 'https://x/dialog.pdf' }],
        },
      ],
    });
    await mount();
  };

  it('does not clip the ring: the row does not truncate, the link does', async () => {
    await setup();
    const li = container.querySelector('li.pdf-files-item') as HTMLElement;
    expect(li.className).not.toContain('truncate');
    const link = li.querySelector('a') as HTMLElement;
    expect(link.querySelector('.pdf-file-name')?.className).toContain(
      'truncate'
    );
    expect(link.className).toContain('max-w-full');
    expect(link.className).toContain('focus-visible:ring-2');
  });

  it('still lists the file links in the Meer details dialog', async () => {
    await setup();
    const button = container.querySelector(
      'button[aria-label="Meer details over vraag 1"]'
    ) as HTMLButtonElement;
    await act(async () => {
      button.click();
    });
    await settle();
    const link = document.body.querySelector(
      '[role="dialog"] a[href="https://x/dialog.pdf"]'
    ) as HTMLElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('dialog.pdf');
  });
});

describe('uploads more line', () => {
  const filesQuestion = (fileCount: number) => ({
    total: 10,
    questions: [
      {
        fieldKey: 'q11',
        type: 'imageUpload',
        title: 'Upload',
        chart: 'files',
        answeredCount: 10,
        fileCount,
        preview: [
          { name: 'a.jpg', url: 'https://x/a.jpg' },
          { name: 'b.jpg', url: 'https://x/b.jpg' },
        ],
      },
    ],
  });
  const moreLine = () =>
    Array.from(container.querySelectorAll('.pdf-files p')).find((p) =>
      p.textContent?.includes('meer')
    );

  it('shows how many files are not listed and opens the dialog', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json(filesQuestion(7));
    routes['/details'] = json({ total: 0, page: 1, pageSize: 2, rows: [] });
    await mount();

    const line = moreLine()!;
    expect(line.textContent).toContain('en 5 meer');
    expect(line.hasAttribute('data-pdf-exclude')).toBe(false);
    const button = line.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('bekijk Meer details');
    await act(async () => {
      button.click();
    });
    await settle();
    expect(document.body.textContent).toContain(
      'Hieronder zie je alle gegeven antwoorden'
    );
  });

  it('shows no line when all files are listed', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json(filesQuestion(2));
    await mount();
    expect(moreLine()).toBeUndefined();
  });

  it('keeps the date and time cells on one line', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({
      total: 1,
      questions: [
        {
          fieldKey: 'q1',
          type: 'multiplechoice',
          title: 'T',
          chart: 'donut',
          answeredCount: 1,
          options: [{ label: 'Ja', count: 1, percentage: 100 }],
        },
      ],
    });
    routes['/details'] = json({
      total: 1,
      page: 1,
      pageSize: 2,
      rows: [{ createdAt: '2026-10-01T10:30:00.000Z', answer: 'Ja' }],
    });
    await mount();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="Meer details over vraag 1"]'
        ) as HTMLButtonElement
      ).click();
    });
    await settle();
    const cells = document.body.querySelectorAll('tbody tr td');
    expect(cells[1].className).toContain('whitespace-nowrap');
    expect(cells[2].className).toContain('whitespace-nowrap');
  });
});

describe('focus ring', () => {
  it('gives every link and button in a card and the dialog a focus ring', async () => {
    routes['submission/widgets'] = json([{ id: 172, description: 'x' }]);
    routes['/enquete/172?'] = json({
      total: 10,
      pdfEnabled: true,
      questions: [
        {
          fieldKey: 'q11',
          type: 'imageUpload',
          title: 'Upload',
          chart: 'files',
          answeredCount: 10,
          fileCount: 7,
          preview: [{ name: 'a.jpg', url: 'https://x/a.jpg' }],
        },
      ],
    });
    routes['/details'] = json({
      total: 5,
      page: 1,
      pageSize: 2,
      rows: [{ createdAt: '2026-10-01T10:30:00.000Z', answer: 'x' }],
    });
    await mount();

    const inCard = Array.from(
      container.querySelectorAll('.pdf-card a, .pdf-card button')
    );
    // Downloaden, Meer details, file link, "bekijk Meer details"
    expect(inCard.length).toBeGreaterThanOrEqual(4);
    inCard.forEach((el) =>
      expect(el.className).toContain('focus-visible:ring-2')
    );

    await act(async () => {
      (
        inCard.find((el) => el.textContent === 'Meer details') as HTMLElement
      ).click();
    });
    await settle();
    const inDialog = Array.from(
      document.body.querySelectorAll('[role="dialog"] button')
    );
    expect(inDialog.length).toBeGreaterThanOrEqual(3); // Datum, Meer laden, Sluiten
    inDialog.forEach((el) =>
      expect(el.className).toContain('focus-visible:ring-2')
    );
  });
});
