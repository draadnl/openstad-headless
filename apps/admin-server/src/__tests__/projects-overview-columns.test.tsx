// @vitest-environment jsdom
import { SessionContext } from '@/auth-context';
import Projects from '@/pages/projects/index';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  push: vi.fn(),
  calls: [] as any[],
}));

const local = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d, 12).toISOString();

const projects = [
  {
    id: 1,
    name: 'Oud project',
    url: 'oud.nl',
    createdAt: local(2025, 1, 5),
    widgetCount: 4,
    config: {
      votes: { isActive: true },
      comments: { canComment: true },
      project: { endDate: local(2026, 3, 9) },
    },
  },
  {
    id: 2,
    name: 'Nieuw project',
    url: 'nieuw.nl',
    createdAt: local(2026, 10, 31),
    widgetCount: 0,
    config: { project: { projectHasEnded: true } },
  },
];

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {}, push: state.push }),
}));

vi.mock('@/hooks/use-project-list', () => ({
  default: (params?: any) => {
    state.calls.push(params);
    if (params?.projectsWithIssues) return { data: [{ id: 1 }, { id: 1 }] };
    return { data: projects };
  },
}));

vi.mock('@/hooks/use-project-folders', () => ({
  default: () => ({
    data: [],
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-template', () => ({
  default: () => ({ createTemplateFromProject: vi.fn() }),
}));

vi.mock('@/components/ui/page-layout', () => ({
  PageLayout: ({ children }: any) => <div>{children}</div>,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render() {
  await act(async () => {
    root.render(
      <SessionContext.Provider value={{ role: 'admin' } as any}>
        <Projects />
      </SessionContext.Provider>
    );
  });
}

const click = async (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

const rows = () => Array.from(container.querySelectorAll('ul > li'));
const cells = (li: Element) =>
  Array.from(li.querySelectorAll('p')).map((p) => p.textContent);

beforeEach(() => {
  state.push.mockClear();
  state.calls.length = 0;
  document.addEventListener('click', (e) => e.preventDefault());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('projects overview columns', () => {
  it('requests the list with includeCounts', async () => {
    await render();
    expect(state.calls).toContainEqual({ includeCounts: true });
  });

  it('shows the headings in the final order', async () => {
    await render();
    const heads = Array.from(
      container.querySelectorAll('.border-b.border-border')[0].children
    ).map((h) => h.textContent);
    expect(heads).toEqual([
      'Projectnaam',
      'Aanmaakdatum',
      'Problemen',
      'Widgets',
      'Deelname',
      'Einddatum',
      'url',
    ]);
  });

  it('renders counts, dates and Deelname for an active project', async () => {
    await render();
    const [li] = rows();
    expect(cells(li).slice(0, 7)).toEqual([
      'Oud project',
      '2025-01-05',
      '2',
      '4',
      'Stemmen, Reacties',
      '2026-03-09',
      'oud.nl',
    ]);
  });

  it('shows an ellipsis span and a tooltip on the Deelname cell', async () => {
    await render();
    const [li] = rows();
    const cell = li.querySelectorAll('p')[4];
    expect(cell.getAttribute('title')).toBe('Stemmen, Reacties');
    const inner = cell.querySelector('span')!;
    expect(inner.classList.contains('block')).toBe(true);
    expect(inner.classList.contains('truncate')).toBe(true);
    expect(inner.textContent).toBe('Stemmen, Reacties');
  });

  it('renders no title on an empty Deelname cell', async () => {
    await render();
    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((b) => b.textContent === 'Beëindigd')!);
    const cell = rows()[0].querySelectorAll('p')[4];
    expect(cell.hasAttribute('title')).toBe(false);
  });

  it('uses the same grid columns on header, folder and project rows', async () => {
    await render();
    const header = container.querySelectorAll('.border-b.border-border')[0];
    const gridClass = (el: Element) =>
      Array.from(el.classList).find((c) => c.startsWith('lg:grid-cols-['));
    expect(gridClass(header)).toBeTruthy();
    for (const li of rows()) {
      expect(gridClass(li)).toBe(gridClass(header));
    }
    expect(container.querySelector('.lg\\:grid-cols-8')).toBeNull();
    expect(container.innerHTML).not.toContain('lg:grid-cols-8');
  });

  it('links the count to /issues without opening the project', async () => {
    await render();
    const link = container.querySelector('a[href="/issues"]')!;
    expect(link.textContent).toBe('2');
    await click(link);
    expect(state.push).not.toHaveBeenCalled();
  });

  it('opens the project on a row click', async () => {
    await render();
    await click(rows()[0]);
    expect(state.push).toHaveBeenCalledWith('/projects/1/widgets');
  });

  it('shows plain 0 and an empty Deelname without Geen', async () => {
    await render();
    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((b) => b.textContent === 'Beëindigd')!);
    const [li] = rows();
    const c = cells(li);
    expect(c[0]).toBe('Nieuw project');
    expect(c[1]).toBe('2026-10-31');
    expect(c[2]).toBe('0');
    expect(c[3]).toBe('0');
    expect(c[4]).toBe('');
    expect(li.querySelector('a[href="/issues"]')).toBeNull();
    expect(container.textContent).not.toContain('Geen');
  });

  it('status filter Beëindigd hides the active project', async () => {
    await render();
    expect(rows()).toHaveLength(1);
    expect(cells(rows()[0])[0]).toBe('Oud project');
    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((b) => b.textContent === 'Beëindigd')!);
    expect(rows().map((r) => cells(r)[0])).toEqual(['Nieuw project']);
  });

  it('lists newest first with all projects', async () => {
    await render();
    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((b) => b.textContent === 'Alle projecten')!);
    expect(rows().map((r) => cells(r)[0])).toEqual([
      'Nieuw project',
      'Oud project',
    ]);
  });

  it('searches in the Deelname field', async () => {
    vi.useFakeTimers();
    await render();
    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((b) => b.textContent === 'Alle projecten')!);
    const select = container.querySelector('select')!;
    const input = container.querySelector('input[type="text"]')!;
    const setValue = (el: any, v: string, proto: any) => {
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
    };
    await act(async () => {
      setValue(select, 'participation', HTMLSelectElement.prototype);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      setValue(input, 'Stemmen', HTMLInputElement.prototype);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    vi.useRealTimers();
    expect(rows().map((r) => cells(r)[0])).toEqual(['Oud project']);
  });
});
