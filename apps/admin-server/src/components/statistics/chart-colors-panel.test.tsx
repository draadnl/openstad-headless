// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartColorsPanel } from './chart-colors-panel';

vi.hoisted(() => {
  (process.env as Record<string, string>).NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const updateProject = vi.fn().mockResolvedValue({});
let projectColors: string[] | undefined;
const DARK = Array(8).fill('#333333');

vi.mock('@/hooks/use-project', () => ({
  useProject: () => ({
    data: { config: { statistics: { chartColors: projectColors } } },
    updateProject,
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

let root: Root | undefined;
let host: HTMLDivElement | undefined;

async function openPanel() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<ChartColorsPanel />));
  const trigger = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Kleuren'
  )!;
  await act(async () => trigger.click());
}

const byText = (text: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent === text
  ) as HTMLButtonElement;

async function setColor(index: number, value: string) {
  const input = document.querySelector(
    `input[type="color"][aria-label="Kleur ${index + 1} (kleurkiezer)"]`
  ) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
  updateProject.mockClear();
  projectColors = undefined;
});

describe('ChartColorsPanel', () => {
  it('shows 8 colours that all pass for a dark palette', async () => {
    projectColors = DARK;
    await openPanel();
    expect(document.querySelectorAll('input[type="color"]')).toHaveLength(8);
    expect(document.body.textContent).toContain('Voldoet');
    expect(document.body.textContent).not.toContain('Te licht');
    expect(byText('Opslaan').disabled).toBe(false);
  });

  it('blocks saving while a colour is too light', async () => {
    projectColors = DARK;
    await openPanel();
    await setColor(0, '#eeeeee');
    expect(document.body.textContent).toContain('Te licht');
    expect(byText('Opslaan').disabled).toBe(true);
    expect(document.body.textContent).toContain(
      'Opslaan kan pas als elke kleur voldoet.'
    );
    expect(byText('Opslaan').getAttribute('aria-describedby')).toBe(
      'chart-colors-save-hint'
    );
  });

  it('saves the chosen colours under statistics.chartColors', async () => {
    projectColors = DARK;
    await openPanel();
    await setColor(0, '#000000');
    await act(async () => byText('Opslaan').click());
    expect(updateProject).toHaveBeenCalledTimes(1);
    const payload = updateProject.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['statistics']);
    expect(payload.statistics.chartColors).toHaveLength(8);
    expect(payload.statistics.chartColors[0]).toBe('#000000');
  });

  it('starts from the colours already saved on the project', async () => {
    projectColors = ['#000000'];
    await openPanel();
    const first = document.querySelector(
      'input[type="color"]'
    ) as HTMLInputElement;
    expect(first.value).toBe('#000000');
  });

  it('sends an empty array (not undefined) to restore the defaults', async () => {
    await openPanel();
    await act(async () => byText('Standaardkleuren herstellen').click());
    expect(updateProject).toHaveBeenCalledWith({
      statistics: { chartColors: [] },
    });
  });
});
