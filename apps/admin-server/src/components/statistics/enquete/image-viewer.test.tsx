// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageViewer } from './image-viewer';

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

const images = [
  { name: 'klein.png', url: 'https://img.test/320x240.png' },
  { name: 'groot.png', url: 'https://img.test/2400x1600.png' },
  { name: 'hoog.png', url: 'https://img.test/200x900.png' },
];

function renderAt(index: number) {
  act(() => {
    root.render(
      <ImageViewer
        images={images}
        index={index}
        onIndexChange={() => {}}
        onClose={() => {}}
      />
    );
  });
}

// Everything except the image itself: the layout classes of each control.
function layoutSnapshot() {
  const q = (selector: string) =>
    document.body.querySelector(selector)?.className;
  return {
    stage: q('[data-testid="image-viewer-stage"]'),
    imageBox: q('[data-testid="image-viewer-image-box"]'),
    close: q('button[aria-label="Sluiten"]'),
    prev: q('button[aria-label="Vorige afbeelding"]'),
    next: q('button[aria-label="Volgende afbeelding"]'),
    counter: q('[data-testid="image-viewer-counter"]'),
  };
}

describe('image viewer layout', () => {
  it('keeps every control in the same place for images of different sizes', () => {
    renderAt(0);
    const small = layoutSnapshot();
    renderAt(1);
    const large = layoutSnapshot();
    renderAt(2);
    const tall = layoutSnapshot();

    expect(large).toEqual(small);
    expect(tall).toEqual(small);
  });

  it('uses a stage with a fixed height and the image fills it', () => {
    renderAt(1);
    const stage = document.body.querySelector(
      '[data-testid="image-viewer-stage"]'
    ) as HTMLElement;
    expect(stage.className).toContain('h-[75vh]');
    expect(stage.className).toContain('grid');
    const img = stage.querySelector('img') as HTMLImageElement;
    expect(img.className).toContain('h-full');
    expect(img.className).toContain('object-contain');
  });

  it('keeps the arrows outside the image box', () => {
    renderAt(1);
    const box = document.body.querySelector(
      '[data-testid="image-viewer-image-box"]'
    ) as HTMLElement;
    expect(box.querySelector('img')).not.toBeNull();
    expect(
      box.querySelector('button[aria-label="Vorige afbeelding"]')
    ).toBeNull();
    expect(
      box.querySelector('button[aria-label="Volgende afbeelding"]')
    ).toBeNull();
    // The arrows are still inside the stage, as grid siblings of the box.
    const stage = document.body.querySelector(
      '[data-testid="image-viewer-stage"]'
    ) as HTMLElement;
    expect(
      stage.querySelector('button[aria-label="Vorige afbeelding"]')
    ).not.toBeNull();
  });

  it('uses a three-column grid on sm and up', () => {
    renderAt(1);
    const stage = document.body.querySelector(
      '[data-testid="image-viewer-stage"]'
    ) as HTMLElement;
    expect(stage.className).toContain('grid');
    expect(stage.className).toContain('sm:grid-cols-[auto_minmax(0,1fr)_auto]');
  });

  it('makes the nav and close buttons at least 44x44', () => {
    renderAt(1);
    for (const label of [
      'Vorige afbeelding',
      'Volgende afbeelding',
      'Sluiten',
    ]) {
      const b = document.body.querySelector(
        `button[aria-label="${label}"]`
      ) as HTMLElement;
      expect(b.className).toContain('h-11');
      expect(b.className).toContain('w-11');
    }
  });

  it('small-screen layout puts the arrows below the image', () => {
    renderAt(1);
    const box = document.body.querySelector(
      '[data-testid="image-viewer-image-box"]'
    ) as HTMLElement;
    expect(box.className).toContain('col-span-2');
    expect(box.className).toContain('row-start-1');
    for (const label of ['Vorige afbeelding', 'Volgende afbeelding']) {
      const b = document.body.querySelector(
        `button[aria-label="${label}"]`
      ) as HTMLElement;
      expect(b.className).toContain('row-start-2');
    }
  });
});

describe('image viewer keyboard and focus', () => {
  function renderWith(index: number) {
    const onIndexChange = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <ImageViewer
          images={images}
          index={index}
          onIndexChange={onIndexChange}
          onClose={onClose}
        />
      );
    });
    return { onIndexChange, onClose };
  }
  const press = (key: string) => {
    const content = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    act(() => {
      content.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    });
  };

  it('ArrowRight and ArrowLeft change the index', () => {
    const { onIndexChange } = renderWith(1);
    press('ArrowRight');
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    press('ArrowLeft');
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it('does not go past the first or last image', () => {
    const first = renderWith(0);
    press('ArrowLeft');
    expect(first.onIndexChange).not.toHaveBeenCalled();
    const last = renderWith(2);
    press('ArrowRight');
    expect(last.onIndexChange).not.toHaveBeenCalled();
  });

  it('disables prev on the first image and next on the last', () => {
    renderAt(0);
    const prev = () =>
      document.body.querySelector(
        'button[aria-label="Vorige afbeelding"]'
      ) as HTMLButtonElement;
    const next = () =>
      document.body.querySelector(
        'button[aria-label="Volgende afbeelding"]'
      ) as HTMLButtonElement;
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);
    renderAt(2);
    expect(prev().disabled).toBe(false);
    expect(next().disabled).toBe(true);
  });

  it('Escape calls onClose', () => {
    const { onClose } = renderWith(1);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the nav buttons a fixed round size, never stretched by the grid', () => {
    renderAt(1);
    for (const label of ['Vorige afbeelding', 'Volgende afbeelding']) {
      const cls = (
        document.body.querySelector(
          `button[aria-label="${label}"]`
        ) as HTMLElement
      ).className;
      expect(cls).toContain('h-11');
      expect(cls).toContain('w-11');
      expect(cls).toContain('shrink-0');
      expect(cls).toContain('rounded-full');
      expect(cls).toContain('self-center');
      expect(cls).toMatch(/(^|\s)justify-self-(start|end)(\s|$)/);
      expect(cls).toContain('sm:justify-self-center');
      expect(cls).not.toContain('justify-self-stretch');
      expect(cls).not.toContain('justify-self-auto');
      expect(cls).not.toMatch(/(^|\s)(sm:)?w-full/);
    }
  });

  it('gives focus back to the element that opened the viewer', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    renderAt(1);
    act(() => root.render(<div />));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
