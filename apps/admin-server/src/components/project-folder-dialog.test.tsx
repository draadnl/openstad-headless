// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectFolderDialog } from './project-folder-dialog';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const projects = [
  { id: 3, name: 'Plannen' },
  { id: 5, name: 'Budget' },
  { id: 8, name: 'Wijkplan' },
];

let container: HTMLElement;
let root: Root;

function render(
  onSubmit: (name: string, ids: number[]) => Promise<unknown>,
  extra: Partial<React.ComponentProps<typeof ProjectFolderDialog>> = {}
) {
  act(() => {
    root.render(
      <ProjectFolderDialog
        open
        onOpenChange={() => {}}
        projects={projects}
        onSubmit={onSubmit}
        {...extra}
      />
    );
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const byText = (selector: string, text: string) =>
  Array.from(document.body.querySelectorAll(selector)).find((el) =>
    el.textContent?.includes(text)
  ) as HTMLElement | undefined;

describe('ProjectFolderDialog', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('shows the Dutch texts and a labelled name field', () => {
    render(vi.fn());
    expect(document.body.textContent).toContain('Map aanmaken');
    expect(document.body.textContent).toContain(
      'Maak een map aan om je projecten in te delen zoals jij het wilt.'
    );
    const input = document.getElementById(
      'project-folder-name'
    ) as HTMLInputElement;
    expect(
      document.querySelector(`label[for="${input.id}"]`)?.textContent
    ).toBe('Naam map');
  });

  it('names the project picker with its label and the picked count', () => {
    render(vi.fn());
    const picker = document.querySelector(
      'button[aria-labelledby]'
    ) as HTMLButtonElement;
    const name = picker
      .getAttribute('aria-labelledby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(name).toBe('Projecten verplaatsen naar deze map Kies projecten');
  });

  it('keeps the submit button disabled while the name is empty', () => {
    render(vi.fn());
    const button = byText('button', 'Map aanmaken') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('submits the name and the chosen project ids', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(onSubmit);

    setInputValue(
      document.getElementById('project-folder-name') as HTMLInputElement,
      '  Templates '
    );

    act(() => {
      (byText('button', 'Kies projecten') as HTMLButtonElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      );
    });
    for (const id of [3, 8]) {
      act(() => {
        (
          document.getElementById(
            `project-folder-project-${id}`
          ) as HTMLButtonElement
        ).click();
      });
    }

    expect(document.body.textContent).toContain('2 projecten geselecteerd');

    await act(async () => {
      (byText('button', 'Map aanmaken') as HTMLButtonElement).click();
    });

    expect(onSubmit).toHaveBeenCalledWith('Templates', [3, 8]);
  }, 30000);

  describe('edit mode', () => {
    const editProps = {
      mode: 'edit' as const,
      initialName: 'Oude naam',
      initialProjectIds: [5, 8],
    };

    it('shows the edit title and the save button', () => {
      render(vi.fn(), editProps);
      expect(document.body.textContent).toContain('Map bewerken');
      expect(document.body.textContent).not.toContain('Map aanmaken');
      expect(byText('button', 'Opslaan')).toBeDefined();
    });

    it('prefills the name and the ticked projects', () => {
      render(vi.fn(), editProps);
      expect(
        (document.getElementById('project-folder-name') as HTMLInputElement)
          .value
      ).toBe('Oude naam');
      expect(document.body.textContent).toContain('2 projecten geselecteerd');
    });

    it('submits the full ticked list', async () => {
      const onSubmit = vi.fn().mockResolvedValue({});
      render(onSubmit, editProps);

      setInputValue(
        document.getElementById('project-folder-name') as HTMLInputElement,
        'Nieuwe naam'
      );
      act(() => {
        (
          byText('button', '2 projecten geselecteerd') as HTMLButtonElement
        ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      for (const id of [5, 3]) {
        act(() => {
          (
            document.getElementById(
              `project-folder-project-${id}`
            ) as HTMLButtonElement
          ).click();
        });
      }

      await act(async () => {
        (byText('button', 'Opslaan') as HTMLButtonElement).click();
      });

      expect(onSubmit).toHaveBeenCalledWith('Nieuwe naam', [8, 3]);
    }, 30000);
  });
});
