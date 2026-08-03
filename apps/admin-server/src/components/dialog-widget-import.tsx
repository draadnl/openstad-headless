import useProjectList from '@/hooks/use-project-list';
import { useWidgetDefinitions } from '@/hooks/use-widget-definitions';
import { useWidgetsHook } from '@/hooks/use-widgets';
import { Import } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

type Props = {
  projectId: string;
  copyWidgets: (sourceProjectId: number, ids: number[]) => Promise<any>;
};

export function ImportWidgetDialog({ projectId, copyWidgets }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [sourceProjectId, setSourceProjectId] = useState<string>('');
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<number[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const widgetDefinitions = useWidgetDefinitions();
  const { data: projects } = useProjectList();
  const {
    data: sourceWidgets,
    isLoading: isLoadingSourceWidgets,
    error: sourceWidgetsError,
  } = useWidgetsHook(sourceProjectId || undefined);

  const otherProjects = (projects || []).filter(
    (project: any) => String(project.id) !== String(projectId)
  );

  function resetState() {
    setSourceProjectId('');
    setSelectedWidgetIds([]);
  }

  function toggleWidget(widgetId: number, checked: boolean) {
    setSelectedWidgetIds((prev) =>
      checked ? [...prev, widgetId] : prev.filter((id) => id !== widgetId)
    );
  }

  async function onImport() {
    if (!sourceProjectId || selectedWidgetIds.length === 0) return;
    setIsImporting(true);
    try {
      await copyWidgets(parseInt(sourceProjectId, 10), selectedWidgetIds);
      toast.success('Widgets successvol geïmporteerd');
      setOpen(false);
      resetState();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Widgets konden niet worden geïmporteerd'
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex w-fit">
          <Import size="20" className="hidden lg:flex" />
          Widget importeren uit ander project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Widget importeren uit ander project</DialogTitle>
          <DialogDescription>
            Kies een bronproject en selecteer de widgets die je wilt importeren
            in dit project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor="import-source-project">
              Bronproject
            </label>
            <Select
              value={sourceProjectId}
              onValueChange={(value) => {
                setSourceProjectId(value);
                setSelectedWidgetIds([]);
              }}>
              <SelectTrigger id="import-source-project">
                <SelectValue placeholder="Selecteer een project" />
              </SelectTrigger>
              <SelectContent className="overflow-y-auto max-h-[16rem]">
                {otherProjects.map((project: any) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceProjectId && (
            <div>
              <label className="text-sm font-medium">Widgets</label>
              {isLoadingSourceWidgets && (
                <p className="text-sm text-muted-foreground">
                  Widgets laden...
                </p>
              )}
              {!isLoadingSourceWidgets && sourceWidgetsError && (
                <p className="text-sm text-destructive">
                  De widgets van dit project konden niet worden opgehaald.
                </p>
              )}
              {!isLoadingSourceWidgets &&
                !sourceWidgetsError &&
                sourceWidgets?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Dit project heeft geen widgets.
                  </p>
                )}
              <ul className="max-h-[16rem] overflow-y-auto space-y-2 mt-2">
                {sourceWidgets?.map((widget: any) => (
                  <li key={widget.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`import-widget-${widget.id}`}
                      checked={selectedWidgetIds.includes(widget.id)}
                      onCheckedChange={(checked) =>
                        toggleWidget(widget.id, !!checked)
                      }
                    />
                    <label htmlFor={`import-widget-${widget.id}`}>
                      <strong>{widget.description}</strong>{' '}
                      <span className="text-sm text-muted-foreground">
                        ({widgetDefinitions[widget.type]?.name})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={selectedWidgetIds.length === 0 || isImporting}
            onClick={onImport}>
            Importeren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
