import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { PDF_CSS } = require('./enquete-pdf-styles');

describe('PDF_CSS fonts', () => {
  it('inlines Inter 400 and 600 as data URIs', () => {
    expect(PDF_CSS).toContain('@font-face');
    expect(PDF_CSS).toContain("font-family: 'Inter'");
    expect(PDF_CSS).toContain('font-weight: 400');
    expect(PDF_CSS).toContain('font-weight: 600');
    expect(PDF_CSS.match(/data:font\/woff2;base64,/g)).toHaveLength(2);
  });

  it('uses Inter as the body font', () => {
    expect(PDF_CSS).toMatch(/body \{[^}]*font-family: 'Inter'/);
  });
});

describe('PDF_CSS stacked rows', () => {
  it('has rules for the row spacing and the dilemma key', () => {
    for (const cls of [
      '.pdf-stacked-row',
      '.pdf-stacked-key',
      '.pdf-stacked-key-item',
    ]) {
      expect(PDF_CSS).toContain(`${cls} {`);
    }
  });

  it('stacks the dilemma key and centres the row', () => {
    expect(PDF_CSS).toMatch(/\.pdf-stacked-key \{[^}]*flex-direction: column/);
    expect(PDF_CSS).not.toMatch(/\.pdf-stacked-key \{[^}]*flex-wrap: wrap/);
    expect(PDF_CSS).toMatch(/\.pdf-stacked-row \{[^}]*align-items: center/);
  });
});

describe('PDF_CSS new chart cards', () => {
  it('has a rule for every class of the stacked and file cards', () => {
    for (const cls of [
      '.pdf-stacked',
      '.pdf-stacked-legend',
      '.pdf-stacked-legend-item',
      '.pdf-stacked-track',
      '.pdf-stacked-fill',
      '.pdf-stacked-key',
      '.pdf-files',
      '.pdf-files-count',
      '.pdf-file-name',
    ]) {
      expect(PDF_CSS).toContain(`${cls} {`);
    }
  });

  it('removes list bullets from the stacked legend', () => {
    expect(PDF_CSS).toMatch(/\.pdf-stacked-legend \{[^}]*list-style: none/);
  });
});

describe('PDF_CSS pdf file list', () => {
  it('has a rule for every file list class', () => {
    for (const cls of [
      '.pdf-files-list',
      '.pdf-files-item',
      '.pdf-files-more',
      '.pdf-file-name',
    ]) {
      expect(PDF_CSS).toContain(`${cls} {`);
    }
  });

  it('removes list bullets from the file list', () => {
    expect(PDF_CSS).toMatch(/\.pdf-files-list \{[^}]*list-style: none/);
  });
});

describe('PDF_CSS map', () => {
  it('keeps the live map aspect ratio instead of a fixed height', () => {
    const rule = PDF_CSS.match(/\.pdf-map \{[^}]*\}/)[0];
    expect(rule).toContain('aspect-ratio: 823 / 367');
    expect(rule).not.toMatch(/\bheight:/);
  });
});

describe('PDF_CSS map fallback', () => {
  it('has a readable rule for the fallback text', () => {
    expect(PDF_CSS).toMatch(/\.pdf-map \.pdf-map-fallback \{[^}]*#6b6b7b/);
  });
});
