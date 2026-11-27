// @vitest-environment jsdom
import { isImageFile } from '@/lib/statistics/enquete-chart-helpers';
import { captureBlockHtml } from '@/lib/statistics/pdf-capture';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileList } from './file-list';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

function render(files: { name: string; url: string | null }[]) {
  act(() => {
    root.render(
      <FileList answeredCount={1} fileCount={files.length} files={files} />
    );
  });
}

describe('file list thumbnail', () => {
  it('thumbnail: an image file renders a lazy img inside a button', () => {
    render([{ name: 'foto.png', url: 'https://img.test/foto.png' }]);
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('alt')).toBe('foto.png');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.closest('a')).toBeNull();
    expect(img.closest('button')).not.toBeNull();
  });

  it('thumbnail: a pdf renders a link without img', () => {
    render([{ name: 'doc.pdf', url: 'https://img.test/doc.pdf' }]);
    expect(host.querySelector('a')).not.toBeNull();
    expect(host.querySelector('img')).toBeNull();
  });

  it('thumbnail: url null renders no link and no img', () => {
    render([{ name: 'foto.png', url: null }]);
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('foto.png');
  });

  it('thumbnail: isImageFile handles case, query strings and non-images', () => {
    expect(isImageFile({ name: 'FOTO.JPG', url: 'https://x/a' })).toBe(true);
    expect(isImageFile({ name: 'foto', url: 'https://x/foto.webp?x=1' })).toBe(
      true
    );
    expect(isImageFile({ name: 'doc.pdf', url: 'https://x/doc.pdf' })).toBe(
      false
    );
    expect(isImageFile({ name: 'a.png', url: null })).toBe(false);
  });

  it('thumbnail: the PDF capture keeps the name but no img', async () => {
    render([{ name: 'foto.png', url: 'https://img.test/foto.png' }]);
    const html = await captureBlockHtml(host);
    expect(html).toContain('foto.png');
    expect(html).not.toContain('<img');
  });

  describe('viewer', () => {
    const three = [
      { name: 'a.png', url: 'https://img.test/a.png' },
      { name: 'b.png', url: 'https://img.test/b.png' },
      { name: 'c.png', url: 'https://img.test/c.png' },
    ];
    const thumb = (n: number) =>
      host.querySelectorAll('button[aria-label^="Bekijk"]')[n] as HTMLElement;
    const counter = () =>
      document.body.querySelector('[data-testid="image-viewer-counter"]')
        ?.textContent;
    const key = (k: string) =>
      act(() => {
        (document.activeElement ?? document.body).dispatchEvent(
          new KeyboardEvent('keydown', { key: k, bubbles: true })
        );
      });

    it('viewer: clicking a thumbnail opens the viewer at that image', () => {
      render(three);
      act(() => thumb(1).click());
      expect(counter()).toBe('2 / 3');
      expect(document.body.textContent).toContain('b.png');
    });

    it('viewer: buttons and arrow keys move, Escape closes', () => {
      render(three);
      act(() => thumb(0).click());
      act(() =>
        (
          document.body.querySelector(
            '[aria-label="Volgende afbeelding"]'
          ) as HTMLElement
        ).click()
      );
      expect(counter()).toBe('2 / 3');
      key('ArrowRight');
      expect(counter()).toBe('3 / 3');
      key('ArrowLeft');
      expect(counter()).toBe('2 / 3');
      key('Escape');
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });

    it('viewer: loads all images of the question once fetched', async () => {
      const all = Array.from({ length: 48 }, (_, i) => ({
        name: `f${i}.png`,
        url: `https://img.test/f${i}.png`,
      }));
      const fetchAll = vi.fn().mockResolvedValue(all);
      act(() => {
        root.render(
          <FileList
            answeredCount={48}
            fileCount={48}
            files={all.slice(0, 5)}
            fetchAllImages={fetchAll}
          />
        );
      });
      await act(async () => {
        thumb(2).click();
      });
      expect(counter()).toBe('3 / 48');
    });

    it('viewer: a pdf stays a link that opens in a new tab', () => {
      render([{ name: 'doc.pdf', url: 'https://img.test/doc.pdf' }]);
      const link = host.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});
