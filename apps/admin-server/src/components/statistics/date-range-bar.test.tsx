// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DateRangeBar } from './date-range-bar';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container: HTMLDivElement;
let root: Root;
const onFromChange = vi.fn();
const onToChange = vi.fn();

const fromDate = new Date(2026, 10, 10);
const toDate = new Date(2026, 10, 20);

function byLabel(text: string) {
  const label = Array.from(container.querySelectorAll('label')).find(
    (l) => l.textContent === text
  );
  const id = label?.getAttribute('for');
  return {
    label,
    button: id ? (container.querySelector(`#${id}`) as HTMLElement) : null,
  };
}

beforeEach(async () => {
  onFromChange.mockClear();
  onToChange.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <DateRangeBar
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={onFromChange}
        onToChange={onToChange}
      />
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

// Opening the Radix popover with a full calendar is slow in jsdom (~10s).
const SLOW = 60000;

describe('DateRangeBar', () => {
  it('links the Van and Tot labels to their buttons', () => {
    const van = byLabel('Van');
    const tot = byLabel('Tot');
    expect(van.button?.tagName).toBe('BUTTON');
    expect(tot.button?.tagName).toBe('BUTTON');
    expect(van.button).not.toBe(tot.button);
    expect(van.button?.textContent).toContain('10 november 2026');
    expect(tot.button?.textContent).toContain('20 november 2026');
  });

  it('wraps on narrow screens', () => {
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('flex-wrap');
    expect(wrapper.className).toContain('w-full');
  });

  it('gives the buttons a 44px touch target', () => {
    expect(byLabel('Van').button?.className).toContain('min-h-[44px]');
    expect(byLabel('Tot').button?.className).toContain('min-h-[44px]');
  });

  it(
    'calls onFromChange when a day is picked',
    async () => {
      await act(async () => {
        byLabel('Van').button!.click();
      });
      const day = Array.from(
        document.body.querySelectorAll('button[name="day"]')
      ).find((b) => b.textContent === '12') as HTMLElement;
      expect(day).toBeTruthy();
      await act(async () => {
        day.click();
      });
      expect(onFromChange).toHaveBeenCalledTimes(1);
      expect(onFromChange.mock.calls[0][0].getDate()).toBe(12);
      expect(onToChange).not.toHaveBeenCalled();
    },
    SLOW
  );

  it(
    'calls onToChange when a day is picked',
    async () => {
      await act(async () => {
        byLabel('Tot').button!.click();
      });
      const day = Array.from(
        document.body.querySelectorAll('button[name="day"]')
      ).find((b) => b.textContent === '25') as HTMLElement;
      await act(async () => {
        day.click();
      });
      expect(onToChange).toHaveBeenCalledTimes(1);
      expect(onToChange.mock.calls[0][0].getDate()).toBe(25);
    },
    SLOW
  );

  it(
    'does not allow a from date after the to date',
    async () => {
      await act(async () => {
        byLabel('Van').button!.click();
      });
      const day = Array.from(
        document.body.querySelectorAll('button[name="day"]')
      ).find((b) => b.textContent === '25') as HTMLButtonElement;
      expect(day.disabled).toBe(true);
    },
    SLOW
  );
});
