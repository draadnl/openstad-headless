// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectFolderDeleteDialog } from './project-folder-delete-dialog';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

function render(
  onConfirm: () => Promise<unknown>,
  onOpenChange: (open: boolean) => void = () => {},
  folderName = 'Wonen 2026'
) {
  act(() => {
    root.render(
      <ProjectFolderDeleteDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        folderName={folderName}
      />
    );
  });
}

const button = (text: string) =>
  Array.from(document.body.querySelectorAll('button')).find(
    (el) => el.textContent === text
  ) as HTMLButtonElement;

describe('ProjectFolderDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('shows the title and the message', () => {
    render(vi.fn());
    expect(document.body.textContent).toContain('Map verwijderen');
    expect(document.body.querySelector('strong')?.textContent).toBe(
      'Wonen 2026'
    );
    expect(document.body.textContent).toContain(
      'De map Wonen 2026 wordt verwijderd. De projecten in deze map blijven bestaan.'
    );
  });

  it('shows a folder name with HTML as literal text', () => {
    render(vi.fn(), () => {}, '<b>x</b>');
    expect(document.body.querySelector('strong')?.textContent).toBe('<b>x</b>');
    expect(document.body.querySelector('[role="dialog"] b')).toBeNull();
  });

  it('confirms once and closes on Verwijderen', async () => {
    const onConfirm = vi.fn().mockResolvedValue({});
    const onOpenChange = vi.fn();
    render(onConfirm, onOpenChange);

    await act(async () => {
      button('Verwijderen').click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith('Map verwijderd.');
  });

  it('does not confirm on Annuleren', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(onConfirm, onOpenChange);

    await act(async () => {
      button('Annuleren').click();
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an error and stays open when confirming fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('nope'));
    const onOpenChange = vi.fn();
    render(onConfirm, onOpenChange);

    await act(async () => {
      button('Verwijderen').click();
    });

    expect(toast.error).toHaveBeenCalledWith('Map verwijderen is niet gelukt.');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Map verwijderen');
  });
});
