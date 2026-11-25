// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionContext } from '../../auth-context';
import { Sidenav } from './sidenav';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const routerState = vi.hoisted(() => ({
  pathname: '/projects',
  query: {} as Record<string, string>,
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ ...routerState, isReady: true }),
}));

const foldersState = vi.hoisted(() => ({
  data: undefined as any,
  error: undefined as any,
  lastOptions: undefined as any,
}));

vi.mock('../../hooks/use-project-folders', () => ({
  default: (options?: any) => {
    foldersState.lastOptions = options;
    return { data: foldersState.data, error: foldersState.error };
  },
}));

let container: HTMLElement;
let root: Root;

async function render(narrow = false) {
  await act(async () => {
    root.render(
      <SessionContext.Provider value={{ role: 'admin' } as any}>
        <Sidenav narrow={narrow} />
      </SessionContext.Provider>
    );
  });
}

function folderList() {
  return container.querySelector('ul[aria-label="Mappen"]');
}

function folderLinks() {
  return Array.from(folderList()?.querySelectorAll('a') ?? []);
}

describe('Sidenav folder submenu', () => {
  beforeEach(() => {
    routerState.pathname = '/projects';
    routerState.query = {};
    foldersState.data = [
      { id: 2, name: 'Wijkplan' },
      { id: 1, name: 'Budget' },
    ];
    foldersState.error = undefined;
    foldersState.lastOptions = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ json: () => Promise.resolve([]) }))
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

  it('lists "Alle projecten" and every folder with the right hrefs', async () => {
    await render();
    const links = folderLinks();
    expect(links.map((a) => a.textContent)).toEqual([
      'Alle projecten',
      'Budget',
      'Wijkplan',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/projects',
      '/projects?folder=1',
      '/projects?folder=2',
    ]);
  });

  it('marks only "Alle projecten" as current on /projects without folder', async () => {
    await render();
    const current = folderLinks().filter(
      (a) => a.getAttribute('aria-current') === 'page'
    );
    expect(current.map((a) => a.textContent)).toEqual(['Alle projecten']);
  });

  it('marks only the active folder as current on /projects?folder=2', async () => {
    routerState.query = { folder: '2' };
    await render();
    const current = folderLinks().filter(
      (a) => a.getAttribute('aria-current') === 'page'
    );
    expect(current.map((a) => a.textContent)).toEqual(['Wijkplan']);
  });

  it('shows only Alle projecten when loading folders fails', async () => {
    foldersState.error = new Error('500');
    await render();
    const links = folderLinks();
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Alle projecten');
    expect(links[0].getAttribute('href')).toBe('/projects');
  });

  it('turns off retry and focus refetch for the folder request', async () => {
    await render();
    expect(foldersState.lastOptions.shouldRetryOnError).toBe(false);
    expect(foldersState.lastOptions.revalidateOnFocus).toBe(false);
  });

  it('renders no folder list when narrow', async () => {
    await render(true);
    expect(folderList()).toBeNull();
  });

  it('renders each submenu item as a single link without a nested button', async () => {
    await render();
    const items = Array.from(folderList()!.querySelectorAll('li'));
    expect(items).toHaveLength(3);
    for (const li of items) {
      expect(li.querySelectorAll('a')).toHaveLength(1);
      expect(li.querySelectorAll('button')).toHaveLength(0);
    }
  });
});
