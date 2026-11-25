import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type ProjectOption = { id: number; name?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  onSubmit: (name: string, projectIds: number[]) => Promise<unknown>;
  mode?: 'create' | 'edit';
  initialName?: string;
  initialProjectIds?: number[];
};

export function ProjectFolderDialog({
  open,
  onOpenChange,
  projects,
  onSubmit,
  mode = 'create',
  initialName = '',
  initialProjectIds = [],
}: Props) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(isEdit ? initialName : '');
      setSelectedIds(isEdit ? initialProjectIds : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: number, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((value) => value !== id)
    );
  }

  async function submit() {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), selectedIds);
      toast.success(isEdit ? 'Map opgeslagen.' : 'Map aangemaakt.');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        isEdit ? 'Map opslaan is niet gelukt.' : 'Map aanmaken is niet gelukt.'
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedLabel =
    selectedIds.length === 0
      ? 'Kies projecten'
      : `${selectedIds.length} ${
          selectedIds.length === 1 ? 'project' : 'projecten'
        } geselecteerd`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Map bewerken' : 'Map aanmaken'}</DialogTitle>
        </DialogHeader>
        <p>
          {isEdit
            ? 'Pas de naam aan en kies welke projecten in deze map staan.'
            : 'Maak een map aan om je projecten in te delen zoals jij het wilt.'}
        </p>

        <div className="space-y-2">
          <label htmlFor="project-folder-name" className="text-sm font-medium">
            Naam map
          </label>
          <Input
            id="project-folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam"
          />
        </div>

        <div className="space-y-2">
          <span
            id="project-folder-projects-label"
            className="text-sm font-medium">
            Projecten verplaatsen naar deze map
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-labelledby="project-folder-projects-label project-folder-projects-count"
                className="flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm">
                <span id="project-folder-projects-count">{selectedLabel}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="max-h-64 w-80 overflow-y-auto">
              <ul className="space-y-2">
                {projects.map((project) => {
                  const id = `project-folder-project-${project.id}`;
                  return (
                    <li key={project.id} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={selectedIds.includes(project.id)}
                        onCheckedChange={(checked) =>
                          toggle(project.id, checked === true)
                        }
                      />
                      <label htmlFor={id} className="text-sm">
                        {project.name || `Project ${project.id}`}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={submit} disabled={saving || !name.trim()}>
          {saving ? 'Bezig met opslaan' : isEdit ? 'Opslaan' : 'Map aanmaken'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
