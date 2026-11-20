// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildHeaderHtml,
  captureBlockHtml,
  captureBlocksHtml,
  formatDutchDay,
} from './pdf-capture';

function el(html: string) {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
}

describe('captureBlockHtml', () => {
  it('removes elements marked data-pdf-exclude and the leaflet controls', async () => {
    const block = el(
      '<div class="pdf-card"><h3>Titel</h3><div data-pdf-exclude><button>Downloaden</button></div><div class="leaflet-control-container">+</div></div>'
    );
    const html = await captureBlockHtml(block);
    expect(html).toContain('Titel');
    expect(html).not.toContain('Downloaden');
    expect(html).not.toContain('leaflet-control-container');
  });

  it('does not change the live element', async () => {
    const block = el('<div><span data-pdf-exclude>x</span></div>');
    await captureBlockHtml(block);
    expect(block.querySelector('[data-pdf-exclude]')).not.toBeNull();
  });

  it('sends no style or link elements', async () => {
    const html = await captureBlockHtml(el('<div class="pdf-card">a</div>'));
    expect(html).not.toMatch(/<(style|link)/i);
  });
});

const flatten = vi.hoisted(() => vi.fn());
vi.mock('./flatten-map', () => ({
  flattenMapToImage: flatten,
  MAP_TOTAL_BUDGET: 200_000,
}));

describe('captureBlockHtml map', () => {
  beforeEach(() => flatten.mockReset());

  const mapHtml =
    '<div class="pdf-card"><div class="pdf-map">' +
    '<img class="leaflet-tile" src="https://a.tile.openstreetmap.org/3/1/2.png">' +
    '<div class="leaflet-marker-icon"><svg></svg></div>'.repeat(5) +
    '</div></div>';

  it('replaces the map content by one data-PNG image', async () => {
    flatten.mockResolvedValue('data:image/jpeg;base64,AAAA');

    const html = await captureBlockHtml(el(mapHtml));
    const map = el(html).querySelector('.pdf-map') as HTMLElement;
    expect(map.querySelectorAll('img')).toHaveLength(1);
    expect(map.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/jpeg;base64,AAAA'
    );
    expect(map.querySelector('svg')).toBeNull();
    expect(html).not.toContain('openstreetmap.org');
  });

  it('retries without tiles when the first drawing fails', async () => {
    flatten
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('data:image/jpeg;base64,BBBB');

    const html = await captureBlockHtml(el(mapHtml));
    expect(flatten).toHaveBeenLastCalledWith(expect.anything(), {
      tiles: false,
      maxChars: 200000,
    });
    expect(html).toContain('data:image/jpeg;base64,BBBB');
  });

  it('never sends tiles or pins when drawing fails', async () => {
    flatten.mockResolvedValue(null);
    const html = await captureBlockHtml(el(mapHtml));
    const map = el(html).querySelector('.pdf-map') as HTMLElement;
    expect(map.querySelector('img')).toBeNull();
    expect(map.querySelector('svg')).toBeNull();
  });

  it('shows a fallback text when both drawing attempts fail', async () => {
    flatten.mockResolvedValue(null);
    const html = await captureBlockHtml(el(mapHtml));
    const map = el(html).querySelector('.pdf-map') as HTMLElement;
    expect(map.querySelector('img')).toBeNull();
    expect(map.querySelector('p.pdf-map-fallback')?.textContent).toBe(
      'Kaart kon niet worden weergegeven'
    );
  });
});

describe('map budget split', () => {
  beforeEach(() => flatten.mockReset());

  const card = (maps: number) =>
    '<div class="pdf-card">' +
    '<div class="pdf-map"></div>'.repeat(maps) +
    '</div>';

  it('gives one map the full budget', async () => {
    flatten.mockResolvedValue('data:image/jpeg;base64,AAAA');
    await captureBlocksHtml([el(card(1))]);
    expect(flatten).toHaveBeenCalledWith(expect.anything(), {
      maxChars: 200000,
    });
  });

  it('splits the budget over two maps', async () => {
    flatten.mockResolvedValue('data:image/jpeg;base64,AAAA');
    await captureBlocksHtml([el(card(1)), el(card(1))]);
    expect(flatten).toHaveBeenCalledTimes(2);
    flatten.mock.calls.forEach((call) => expect(call[1].maxChars).toBe(100000));
  });

  it('splits the budget over three maps in one card per block count', async () => {
    flatten.mockResolvedValue('data:image/jpeg;base64,AAAA');
    await captureBlocksHtml([el(card(2)), el(card(1))]);
    expect(flatten).toHaveBeenCalledTimes(3);
    flatten.mock.calls.forEach((call) => expect(call[1].maxChars).toBe(66666));
  });

  it('passes the budget to the no-tiles retry too', async () => {
    flatten.mockResolvedValueOnce(null).mockResolvedValueOnce('data:x');
    await captureBlockHtml(el(card(2)), { mapBudget: 5000 });
    expect(flatten).toHaveBeenCalledWith(expect.anything(), {
      tiles: false,
      maxChars: 5000,
    });
  });
});

describe('header and combined capture', () => {
  it('formats a Dutch day', () => {
    expect(formatDutchDay('2026-09-12')).toBe('12 september 2026');
  });

  it('builds the title block with widget, period and count', () => {
    const html = buildHeaderHtml({
      widgetLabel: 'Widget 172 - <b>Buurt</b>',
      from: '2026-09-12',
      to: '2026-10-12',
      total: 127,
    });
    expect(html).toContain('Enquêtes');
    expect(html).toContain('Widget 172 - &lt;b&gt;Buurt&lt;/b&gt;');
    expect(html).toContain('Van 12 september 2026 tot 12 oktober 2026');
    expect(html).toContain('127 reacties');
  });

  it('puts the header before all blocks, in order', async () => {
    const html = await captureBlocksHtml(
      [el('<div id="a">A</div>'), el('<div id="b">B</div>')],
      '<div class="pdf-header">H</div>'
    );
    expect(html.indexOf('pdf-header')).toBeLessThan(html.indexOf('id="a"'));
    expect(html.indexOf('id="a"')).toBeLessThan(html.indexOf('id="b"'));
  });
});

describe('captureBlockHtml screen-reader text', () => {
  it('removes sr-only text from the copy but not from the live element', async () => {
    const block = el(
      '<div class="pdf-card"><span class="sr-only">Vraag 7, rij</span><span>Zichtbaar</span></div>'
    );
    const html = await captureBlockHtml(block);
    expect(html).not.toContain('Vraag 7');
    expect(html).toContain('Zichtbaar');
    expect(block.querySelector('.sr-only')).not.toBeNull();
  });
});

describe('captureBlockHtml file list', () => {
  it('keeps the "en N meer" text but drops the details button', async () => {
    const block = el(
      '<div class="pdf-card"><div class="pdf-files"><p class="pdf-files-more">en 5 meer<span data-pdf-exclude> – <button>bekijk Meer details</button></span></p></div></div>'
    );
    const html = await captureBlockHtml(block);
    expect(html).toContain('en 5 meer');
    expect(html).not.toContain('bekijk Meer details');
  });
});

describe('captureBlockHtml animated charts', () => {
  it('keeps the final widths and drops animation styles and markers', async () => {
    const html = await captureBlockHtml(
      el(
        '<div class="pdf-card enq-motion"><style>.pdf-bar-fill{animation:x 600ms}</style>' +
          '<div class="pdf-bar-fill" style="width: 42%"></div>' +
          '<div class="pdf-stacked-fill" style="width: 30%"></div>' +
          '<div class="pdf-donut" data-chart-animating="false"></div></div>'
      )
    );
    expect(html).toContain('width: 42%');
    expect(html).toContain('width: 30%');
    expect(html).not.toContain('<style');
    expect(html).not.toContain('animation');
    expect(html).not.toContain('data-chart-animating');
  });

  it('waits for a growing donut before it copies the block', async () => {
    const block = el(
      '<div class="pdf-card"><div data-chart-animating="true"></div></div>'
    );
    setTimeout(
      () =>
        block
          .querySelector('[data-chart-animating]')!
          .setAttribute('data-chart-animating', 'false'),
      80
    );
    const html = await captureBlockHtml(block);
    expect(html).not.toContain('data-chart-animating');
  });
});
