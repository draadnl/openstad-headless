// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnswersDialog } from './answers-dialog';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const onOpenChange = vi.fn();

const settle = () => act(async () => {});

beforeEach(async () => {
  onOpenChange.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        total: 1,
        page: 1,
        pageSize: 25,
        rows: [{ createdAt: '2026-10-01T10:30:00.000Z', answer: 'Tevreden' }],
      }),
    }))
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <AnswersDialog
        open
        onOpenChange={onOpenChange}
        project="2"
        widgetId="172"
        from="2026-01-01"
        to="2026-12-31"
        fieldKey="q1"
        title="Hoe tevreden?"
        number={1}
        options={[]}
      />
    );
  });
  await settle();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('AnswersDialog', () => {
  it('renders a visible Sluiten button that closes the dialog', () => {
    const close = document.body.querySelector(
      '[role="dialog"] button[aria-label="Sluiten"]'
    ) as HTMLElement;
    expect(close).toBeTruthy();
    expect(close.className).not.toContain('sr-only');
    act(() => close.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('centre: the dialog is centred without translate or left/top offsets', () => {
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    expect(dialog.className).not.toContain('translate-');
    expect(dialog.className).not.toContain('left-1/2');
    expect(dialog.className).not.toContain('top-1/2');
  });

  it('centre: a click-through grid wrapper centres the dialog', () => {
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const wrapper = dialog.parentElement as HTMLElement;
    expect(wrapper.getAttribute('data-testid')).toBe('answers-dialog-centre');
    expect(wrapper.className).toContain('place-items-center');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(dialog.className).toContain('pointer-events-auto');
  });

  it('centre: dialog and overlay share the same motion classes', () => {
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const overlay = (dialog.parentElement as HTMLElement)
      .previousElementSibling as HTMLElement;
    for (const cls of [
      'fade-in-0',
      'duration-200',
      'ease-out',
      'motion-reduce:!animate-none',
    ]) {
      expect(dialog.className).toContain(cls);
      expect(overlay.className).toContain(cls);
    }
    expect(dialog.className).toContain('zoom-in-95');
  });

  it('closes on Escape, same as the Sluiten button', () => {
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('fits 375px: content has a viewport-bound max width and compact padding', () => {
    const dialog = document.body.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]');
    expect(dialog.className).toMatch(/(^|\s)p-4(\s|$)/);
  });

  it('fits 375px: the table scrolls horizontally inside its own wrapper', () => {
    const table = document.body.querySelector('table') as HTMLElement;
    expect(table.parentElement?.className).toContain('overflow-x-auto');
  });

  it('close button is a 44x44 tap target', () => {
    const close = document.body.querySelector(
      'button[aria-label="Sluiten"]'
    ) as HTMLElement;
    expect(close.className).toContain('h-11');
    expect(close.className).toContain('w-11');
  });

  it('Datum sort button is at least a 44px tap target', () => {
    const btn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Datum'
    ) as HTMLElement;
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('min-w-[44px]');
  });
});
