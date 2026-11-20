import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { sanitizePdfHtml, isAllowedImageSrc } = require('./sanitize-pdf-html');

const OSM = 'https://a.tile.openstreetmap.org/3/1/2.png';

describe('sanitizePdfHtml (basic)', () => {
  it('keeps safe tags, pdf- classes and plain styles', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-card other" style="width: 50%">Hi</div>'
    );
    expect(out).toBe('<div class="pdf-card" style="width:50%">Hi</div>');
  });

  it('keeps svg shapes with their camelCase attributes', () => {
    const out = sanitizePdfHtml(
      '<svg viewBox="0 0 10 10"><circle cx="1" cy="1" r="2" fill="#fff"></circle></svg>'
    );
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<circle');
  });

  it('removes script and style elements with their content', () => {
    const out = sanitizePdfHtml(
      '<p>a</p><script>alert(1)</script><style>x{}</style>'
    );
    expect(out).toBe('<p>a</p>');
  });

  it('returns an empty string for non-string input', () => {
    expect(sanitizePdfHtml(undefined)).toBe('');
  });
});

describe('sanitizePdfHtml (attacks)', () => {
  const clean = (html) => sanitizePdfHtml(html);

  it.each([
    ['style element', '<style>@import url(http://x/a.css)</style><p>a</p>'],
    ['link element', '<link rel="stylesheet" href="http://x/a.css"><p>a</p>'],
    ['script element', '<script src="http://x/a.js"></script><p>a</p>'],
    ['iframe', '<iframe src="http://x"></iframe><p>a</p>'],
    ['object', '<object data="http://x"></object><p>a</p>'],
    ['embed', '<embed src="http://x"><p>a</p>'],
  ])('drops %s', (_name, html) => {
    const out = clean(html);
    expect(out).not.toMatch(/<(style|link|script|iframe|object|embed)/i);
    expect(out).not.toContain('http://x');
  });

  it('drops event handler attributes in any case', () => {
    const out = clean(
      '<div onclick="a()" ONMOUSEOVER="b()" class="pdf-a" onload="c()">x</div>'
    );
    expect(out).not.toMatch(/on[a-z]+=/i);
  });

  it('drops srcset, href and xlink:href', () => {
    const out = clean(
      `<img src="${OSM}" srcset="http://x/a.png 2x"><svg><use href="http://x#a"></use><use xlink:href="http://x#a"></use><path d="M0 0" href="http://x"></path></svg>`
    );
    expect(out).not.toContain('srcset');
    expect(out).not.toContain('href');
    expect(out).not.toContain('<use');
    expect(out).not.toContain('http://x');
  });

  it('drops foreignObject itself', () => {
    expect(
      clean('<svg><foreignObject><p>a</p></foreignObject></svg>')
    ).not.toMatch(/foreignobject/i);
  });

  it('keeps only OSM tile images and data png/svg images', () => {
    expect(clean(`<img src="${OSM}">`)).toContain(OSM);
    expect(clean('<img src="data:image/png;base64,AAAA">')).toContain('<img');
    expect(clean('<img src="data:image/svg+xml;base64,AAAA">')).toContain(
      '<img'
    );
    for (const src of [
      'https://evil.example/a.png',
      'http://a.tile.openstreetmap.org/3/1/2.png',
      'https://a.tile.openstreetmap.org/3/1/2.png?x=1',
      'https://a.tile.openstreetmap.org.evil.example/3/1/2.png',
      'https://d.tile.openstreetmap.org/3/1/2.png',
      'https://a.tile.openstreetmap.org/../3/1/2.png',
      'data:text/html;base64,AAAA',
      'javascript:alert(1)',
      '//evil.example/a.png',
    ]) {
      expect(clean(`<img src="${src}">`)).not.toContain('<img');
    }
  });

  it('keeps the map fallback paragraph', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-map"><p class="pdf-map-fallback">Kaart kon niet worden weergegeven</p></div>'
    );
    expect(out).toContain(
      '<p class="pdf-map-fallback">Kaart kon niet worden weergegeven</p>'
    );
  });

  it('keeps the flattened map image with its class and an empty-safe alt', () => {
    const out = clean(
      '<div class="pdf-map" style="width:823px;height:367px"><img class="pdf-map-image" alt="Kaart" src="data:image/png;base64,AAAA"></div>'
    );
    expect(out).toContain('class="pdf-map-image"');
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  it('keeps a data jpeg image, also inside the map wrapper', () => {
    expect(clean('<img src="data:image/jpeg;base64,AAAA">')).toContain(
      'src="data:image/jpeg;base64,AAAA"'
    );
    const out = clean(
      '<div class="pdf-map" style="width:823px;height:367px"><img class="pdf-map-image" alt="Kaart" src="data:image/jpeg;base64,AAAA"></div>'
    );
    expect(out).toContain('class="pdf-map-image"');
    expect(out).toContain('src="data:image/jpeg;base64,AAAA"');
  });

  it('rejects non-jpeg lookalike image sources', () => {
    for (const src of [
      'data:image/jpg;base64,AAAA',
      'data:image/gif;base64,AAAA',
      'data:image/webp;base64,AAAA',
      'data:text/html;base64,AAAA',
    ]) {
      expect(isAllowedImageSrc(src)).toBe(false);
      expect(clean(`<img src="${src}">`)).not.toContain('<img');
    }
    expect(isAllowedImageSrc('data:image/jpeg;base64,AAAA')).toBe(true);
  });

  it('strips a jpeg data URL used as href on a link or svg image', () => {
    const out = clean(
      '<a href="data:image/jpeg;base64,AAAA">x</a><svg><image href="data:image/jpeg;base64,AAAA"></image></svg>'
    );
    expect(out).not.toContain('href');
    expect(out).not.toContain('data:image/jpeg');
  });

  it.each([
    ['url(', 'background-color: URL(http://x)'],
    ['url (', 'background-color: url (http://x)'],
    ['escaped url', 'background-color: \\75rl(http://x)'],
    ['@import', 'color: @import'],
    ['image-set', 'background-color: image-set(a 1x)'],
    ['expression', 'width: expression(alert(1))'],
    ['backslash', 'color: re\\64'],
  ])('drops a style value with %s', (_name, style) => {
    const out = clean(`<div style="${style}; height: 5px">x</div>`);
    expect(out).not.toMatch(/url|import|image-set|expression|\\/i);
    expect(out).toContain('height:5px');
  });

  it('drops style properties that are not on the list', () => {
    const out = clean(
      '<div style="background-image: red; behavior: x; width: 1px">x</div>'
    );
    expect(out).not.toContain('background-image');
    expect(out).not.toContain('behavior');
    expect(out).toContain('width:1px');
  });

  it('drops classes that are not pdf-* or leaflet-*', () => {
    const out = clean(
      '<div class="pdf-a leaflet-pane evil pdf_b x-pdf-c">x</div>'
    );
    expect(out).toContain('class="pdf-a leaflet-pane"');
  });

  it('keeps what the real blocks need', () => {
    const out = clean(
      `<div class="pdf-map"><div class="leaflet-pane" style="transform: translate3d(1px, 2px, 0px)"><img class="leaflet-tile" src="${OSM}"></div><svg viewBox="0 0 5 5"></svg></div>`
    );
    expect(out).toContain(OSM);
    expect(out).toContain('viewBox="0 0 5 5"');
    expect(out).toContain('translate3d(1px, 2px, 0px)');
  });

  it('drops url() in SVG paint attributes', () => {
    const out = clean(
      '<svg><path d="M0" fill="url(http://evil/x)" stroke="URL(#a)" font-size="url(x)"></path><text fill="#fff">a</text></svg>'
    );
    expect(out).not.toMatch(/url/i);
    expect(out).toContain('fill="#fff"');
    expect(out).toContain('d="M0"');
  });

  it('refuses position fixed', () => {
    expect(clean('<div style="position: fixed; top: 0">x</div>')).not.toContain(
      'fixed'
    );
  });
});

describe('sanitizePdfHtml (recharts)', () => {
  it('keeps what the recharts donut needs', () => {
    const html =
      '<svg class="recharts-surface" width="200" height="200" viewBox="0 0 200 200">' +
      '<defs><clipPath id="recharts1-clip"><rect x="5" y="5" width="190" height="190"></rect></clipPath></defs>' +
      '<g class="recharts-layer"><path fill="#6f6fe0" stroke="#ffffff" stroke-width="2" d="M10 10 L20 20"></path></g>' +
      '<text x="100" y="100" fill="#1e1e2e" text-anchor="middle" dominant-baseline="central">21%</text>' +
      '</svg>';
    const out = sanitizePdfHtml(html);
    expect(out).not.toContain('<rect');
    expect(out).not.toContain('clipPath');
    expect(out).not.toContain('defs');
    expect(out).toContain('<path');
    expect(out).toContain('fill="#6f6fe0"');
    expect(out).toContain('fill="#1e1e2e"');
    expect(out).toContain('text-anchor="middle"');
    expect(out).toContain('21%');
  });
});

describe('sanitizePdfHtml (stacked, ranking and file markup)', () => {
  it('keeps the pdf- classes and widths of stacked rows', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-stacked"><ul class="pdf-stacked-legend"><li class="pdf-stacked-legend-item"><span class="pdf-dot" style="background-color:#5b5fc7"></span>Ja</li></ul>' +
        '<div class="pdf-bar-row pdf-stacked-row" style="min-height:32px"><div class="pdf-stacked-track"><div class="pdf-stacked-fill" style="width:60%;background-color:#5b5fc7"></div></div></div></div>'
    );
    expect(out).toContain('class="pdf-stacked-track"');
    expect(out).toContain(
      'class="pdf-stacked-fill" style="width:60%;background-color:#5b5fc7"'
    );
    expect(out).toContain('pdf-stacked-legend-item');
    expect(out).toContain('min-height:32px');
  });

  it('keeps ranking grid, bar and axis markup', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-bars"><div class="pdf-bar-track"><div class="pdf-bar-grid"><div class="pdf-bar-gridline" style="left:50%"></div></div><div class="pdf-bar-fill" style="width:75%;background-color:#5b5fc7"></div></div><div class="pdf-bar-axis"><div class="pdf-bar-ticks"><span class="pdf-bar-tick" style="left:50%">2</span></div></div></div>'
    );
    for (const cls of [
      'pdf-bar-grid',
      'pdf-bar-gridline',
      'pdf-bar-fill',
      'pdf-bar-axis',
      'pdf-bar-tick',
    ]) {
      expect(out).toContain(cls);
    }
    expect(out).toContain('width:75%');
  });

  it('keeps file names with their class but drops the link', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-files"><p class="pdf-files-count">3 bestanden</p><ul><li><a href="https://x/a.jpg" class="pdf-file-name">a.jpg</a></li></ul></div>'
    );
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
    expect(out).toContain('a.jpg');
  });
});

describe('sanitizePdfHtml (pdf file list)', () => {
  it('keeps the file list classes and text but drops the link', () => {
    const out = sanitizePdfHtml(
      '<div class="pdf-files"><ul class="pdf-files-list"><li class="pdf-files-item"><a href="https://x/a.jpg" class="inline-block"><span class="pdf-file-name">a.jpg</span></a></li></ul><p class="pdf-files-more">en 5 meer</p></div>'
    );
    expect(out).toContain('pdf-files-list');
    expect(out).toContain('pdf-files-item');
    expect(out).toContain('<span class="pdf-file-name">a.jpg</span>');
    expect(out).toContain('pdf-files-more');
    expect(out).toContain('en 5 meer');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
  });
});

describe('sanitizePdfHtml (map image drift)', () => {
  it('keeps the data url of the mime that flatten-map really produces', () => {
    const source = fs.readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../admin-server/src/lib/statistics/flatten-map.ts'
      ),
      'utf8'
    );
    const match = /MAP_IMAGE_MIME\s*=\s*['"]([^'"]+)['"]/.exec(source);
    if (!match) throw new Error('MAP_IMAGE_MIME not found in flatten-map.ts');
    const mime = match[1];
    // A real 1x1 JPEG.
    const jpeg =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const src = `data:${mime};base64,${jpeg}`;
    const out = sanitizePdfHtml(
      `<div class="pdf-map"><img class="pdf-map-image" src="${src}"></div>`
    );
    expect(out).toContain(`src="${src}"`);
  });
});
