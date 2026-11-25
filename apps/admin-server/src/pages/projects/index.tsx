import { SessionContext } from '@/auth-context';
import { ProjectFolderDeleteDialog } from '@/components/project-folder-delete-dialog';
import { ProjectFolderDialog } from '@/components/project-folder-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageLayout } from '@/components/ui/page-layout';
import { sortTable } from '@/components/ui/sortTable';
import { ListHeading, Paragraph } from '@/components/ui/typography';
import useProjectFolders from '@/hooks/use-project-folders';
import useTemplates from '@/hooks/use-template';
import { HasAccess } from '@/lib/hasAccess';
import {
  groupProjectsByFolder,
  parseFolderQuery,
  projectCreateHref,
} from '@/lib/project-folders';
import {
  countIssuesByProject,
  formatIsoDate,
  participationLabels,
  withOverviewCounts,
} from '@/lib/project-overview-columns';
import {
  Check,
  ChevronRight,
  Folder,
  LayoutTemplate,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';
import toast from 'react-hot-toast';

import projectListSwr from '../../hooks/use-project-list';

type SearchableField = {
  key: string;
  label: string;
  getValue: (project: any) => string;
};

const OVERVIEW_GRID_COLUMNS =
  'grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]';

const SEARCHABLE_FIELDS: SearchableField[] = [
  { key: 'name', label: 'Projectnaam', getValue: (p) => p?.name || '' },
  { key: 'url', label: 'URL', getValue: (p) => p?.url || '' },
  {
    key: 'createdAt',
    label: 'Aanmaakdatum',
    getValue: (p) => formatIsoDate(p?.createdAt),
  },
  {
    key: 'participation',
    label: 'Deelname',
    getValue: (p) => participationLabels(p).join(', '),
  },
  {
    key: 'endDate',
    label: 'Einddatum',
    getValue: (p) => formatIsoDate(p?.config?.project?.endDate),
  },
];

const fieldsByKey = Object.fromEntries(
  SEARCHABLE_FIELDS.map((f) => [f.key, f])
);

const applyStatusFilter = (
  projects: any[],
  status: 'all' | 'ended' | 'active'
) => {
  if (!projects) return projects;
  if (status === 'all') return projects;
  if (status === 'ended')
    return projects.filter(
      (p: any) => p?.config?.project?.projectHasEnded === true
    );
  return projects.filter(
    (p: any) => p?.config?.project?.projectHasEnded !== true
  );
};

const applySearchFilter = (projects: any[], term: string, fieldKey: string) => {
  if (!projects || term.length < 1) return projects;
  const lowerTerm = term.toLowerCase();
  return projects.filter((item: any) => {
    if (fieldKey) {
      return (
        fieldsByKey[fieldKey]
          ?.getValue(item)
          .toLowerCase()
          .includes(lowerTerm) ?? false
      );
    }
    return SEARCHABLE_FIELDS.some((field) =>
      field.getValue(item).toLowerCase().includes(lowerTerm)
    );
  });
};

export default function Projects() {
  const { data: listData } = projectListSwr({ includeCounts: true });
  const { data: issuesData } = projectListSwr({ projectsWithIssues: true });
  const data = useMemo(
    () =>
      listData && issuesData
        ? withOverviewCounts(listData, countIssuesByProject(issuesData))
        : listData,
    [listData, issuesData]
  );
  const router = useRouter();

  const [filterSearchType, setFilterSearchType] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ended' | 'active'>(
    'active'
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    let result = applyStatusFilter(data, statusFilter);
    return applySearchFilter(result, searchTerm, filterSearchType);
  }, [data, statusFilter, searchTerm, filterSearchType]);

  const sessionData = useContext(SessionContext);
  const isAdmin = !!HasAccess(sessionData);
  const isSuperuser = sessionData?.role === 'superuser';

  const {
    data: folders,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useProjectFolders();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const folderId = parseFolderQuery(router.query.folder);
  const openFolder = folderId
    ? (folders || []).find((f) => f.id === folderId)
    : undefined;

  const grouped = useMemo(
    () =>
      groupProjectsByFolder(filteredData || [], folders || [], {
        folderId,
        hasSearch: searchTerm.length > 0,
        isAdmin: isSuperuser,
      }),
    [filteredData, folders, folderId, searchTerm, isSuperuser]
  );

  // Separate state for column sorting (sortTable mutates imperatively)
  const [sortedData, setSortedData] = useState<any[] | null>(null);
  useEffect(() => setSortedData(null), [grouped]);

  const displayData = sortedData ?? grouped.projects;
  const { createTemplateFromProject } = useTemplates();

  const [templateSource, setTemplateSource] = useState<any>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  async function saveAsTemplate() {
    if (!templateSource || !templateName.trim()) return;
    setTemplateSaving(true);
    try {
      await createTemplateFromProject(templateName.trim(), templateSource.id);
      toast.success('Template opgeslagen.');
      setTemplateSource(null);
    } catch (error) {
      toast.error('Opslaan als template is niet gelukt.');
    } finally {
      setTemplateSaving(false);
    }
  }

  if (!data)
    return (
      <div>
        <PageLayout
          pageHeader="Projecten"
          breadcrumbs={[
            {
              name: 'Projecten',
              url: '/projects',
            },
          ]}
          action={
            HasAccess(sessionData) && (
              <Link href="/projects/create">
                <Button variant="default" className="flex w-fit">
                  <Plus size="20" className="hidden lg:flex" />
                  Project toevoegen
                </Button>
              </Link>
            )
          }></PageLayout>
      </div>
    );

  return (
    <div>
      <PageLayout
        pageHeader="Projecten"
        breadcrumbs={[
          {
            name: 'Projecten',
            url: '/projects',
          },
        ]}
        action={
          HasAccess(sessionData) && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex w-fit"
                onClick={() => setFolderDialogOpen(true)}>
                <Folder size="20" className="hidden lg:flex" />
                Nieuwe map aanmaken
              </Button>
              <Link href="/projects/create">
                <Button variant="default" className="flex w-fit">
                  <Plus size="20" className="hidden lg:flex" />
                  Project toevoegen
                </Button>
              </Link>
            </div>
          )
        }>
        <div className="container py-6">
          <div className="flex items-center justify-between mb-4 px-6 py-5 bg-white rounded-md border border-border">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex gap-1.5">
                {(
                  [
                    { value: 'all', label: 'Alle projecten' },
                    { value: 'active', label: 'Actief' },
                    { value: 'ended', label: 'Beëindigd' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      statusFilter === option.value
                        ? 'border-border bg-gray-100 font-medium text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-gray-50'
                    }`}
                    onClick={() => setStatusFilter(option.value)}>
                    {statusFilter === option.value && (
                      <Check size={14} strokeWidth={2.5} />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="px-4 py-2.5 text-sm rounded-md border border-border bg-white w-56"
                placeholder="Zoeken..."
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="px-4 py-2.5 text-sm rounded-md border border-border bg-white w-36"
                onChange={(e) => setFilterSearchType(e.target.value)}>
                <option value="">Zoek alles</option>
                {SEARCHABLE_FIELDS.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {folderId !== null && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <nav aria-label="Kruimelpad mappen" className="text-sm">
                <Link href="/projects" className="underline">
                  Alle projecten
                </Link>
                <span className="mx-2" aria-hidden="true">
                  /
                </span>
                <span aria-current="page" className="font-medium">
                  {openFolder?.name ?? 'Map'}
                </span>
              </nav>
              {isAdmin && openFolder && (
                <div className="flex gap-2">
                  <Link href={projectCreateHref(openFolder.id)}>
                    <Button variant="default" className="flex w-fit">
                      <Plus size="20" className="hidden lg:flex" />
                      Project aanmaken in map
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    onClick={() => setEditFolderOpen(true)}>
                    Map bewerken
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteFolderOpen(true)}>
                    Map verwijderen
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="p-6 bg-white rounded-md clear-right">
            <div
              className={`grid ${OVERVIEW_GRID_COLUMNS} items-center py-2 px-2 border-b border-border`}>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('name', e, displayData))
                  }>
                  Projectnaam
                </button>
              </ListHeading>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('createdAt', e, displayData))
                  }>
                  Aanmaakdatum
                </button>
              </ListHeading>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('issueCount', e, displayData))
                  }>
                  Problemen
                </button>
              </ListHeading>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('widgetCount', e, displayData))
                  }>
                  Widgets
                </button>
              </ListHeading>
              <ListHeading className="hidden lg:flex">Deelname</ListHeading>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('endDate', e, displayData))
                  }>
                  Einddatum
                </button>
              </ListHeading>
              <ListHeading className="hidden lg:flex">
                <button
                  className="filter-button"
                  onClick={(e) =>
                    setSortedData(sortTable('url', e, displayData))
                  }>
                  url
                </button>
              </ListHeading>
            </div>
            <ul>
              {grouped.folders.map(({ folder, count }) => (
                <li
                  key={`folder-${folder.id}`}
                  className={`grid ${OVERVIEW_GRID_COLUMNS} items-center py-3 px-2 h-16 bg-gray-100 hover:bg-gray-200 border-b border-border gap-2`}>
                  <Link
                    href={`/projects?folder=${folder.id}`}
                    className="col-span-2 lg:col-span-7 flex items-center gap-3 h-full">
                    <Folder strokeWidth={1.5} className="w-5 h-5 shrink-0" />
                    <Paragraph className="truncate font-medium">
                      {folder.name}
                    </Paragraph>
                    <Paragraph className="text-muted-foreground">
                      {count} {count === 1 ? 'project' : 'projecten'}
                    </Paragraph>
                  </Link>
                  <Paragraph className="flex items-center justify-end">
                    <ChevronRight
                      strokeWidth={1.5}
                      className="w-5 h-5 my-auto"
                    />
                  </Paragraph>
                </li>
              ))}
              {displayData?.map((project: any) => {
                const participation =
                  fieldsByKey.participation.getValue(project);
                const endDate = fieldsByKey.endDate.getValue(project);
                const projectUrl = fieldsByKey.url.getValue(project);
                return (
                  <li
                    className={`grid ${OVERVIEW_GRID_COLUMNS} items-center py-3 px-2 h-16 hover:bg-secondary-background hover:cursor-pointer border-b border-border gap-2`}
                    key={project.id}
                    onClick={() =>
                      router.push(`/projects/${project.id}/widgets`)
                    }>
                    <Paragraph className="truncate">
                      {fieldsByKey.name.getValue(project)}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate">
                      {fieldsByKey.createdAt.getValue(project)}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate">
                      {project.issueCount ===
                      undefined ? null : project.issueCount > 0 ? (
                        <Link
                          href="/issues"
                          className="underline"
                          aria-label={`${project.issueCount} problemen bekijken`}
                          onClick={(e) => e.stopPropagation()}>
                          {project.issueCount}
                        </Link>
                      ) : (
                        0
                      )}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate">
                      {Number(project.widgetCount ?? 0)}
                    </Paragraph>
                    <Paragraph
                      className="hidden lg:flex min-w-0"
                      title={participation || undefined}>
                      <span className="block truncate">{participation}</span>
                    </Paragraph>
                    <Paragraph
                      className="hidden lg:flex min-w-0"
                      title={endDate || undefined}>
                      <span className="block truncate">{endDate}</span>
                    </Paragraph>
                    <Paragraph
                      className="hidden lg:flex min-w-0"
                      title={projectUrl || undefined}>
                      <span className="block truncate">{projectUrl}</span>
                    </Paragraph>
                    <Paragraph className="flex items-center justify-end gap-2">
                      {HasAccess(sessionData) && (
                        <button
                          type="button"
                          title="Bewaar als template"
                          aria-label={`Bewaar project ${
                            project.name || ''
                          } als template`}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateName(project.name || '');
                            setTemplateSource(project);
                          }}>
                          <LayoutTemplate
                            strokeWidth={1.5}
                            className="w-5 h-5"
                          />
                        </button>
                      )}
                      <ChevronRight
                        strokeWidth={1.5}
                        className="w-5 h-5 my-auto"
                      />
                    </Paragraph>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <ProjectFolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          projects={data || []}
          onSubmit={createFolder}
        />

        {folderId !== null && openFolder && (
          <ProjectFolderDialog
            mode="edit"
            open={editFolderOpen}
            onOpenChange={setEditFolderOpen}
            projects={data || []}
            initialName={openFolder.name}
            initialProjectIds={(data || [])
              .filter((p: any) => p.folderId === folderId)
              .map((p: any) => p.id)}
            onSubmit={(name, ids) => updateFolder(folderId, name, ids)}
          />
        )}

        {folderId !== null && openFolder && (
          <ProjectFolderDeleteDialog
            open={deleteFolderOpen}
            onOpenChange={setDeleteFolderOpen}
            folderName={openFolder.name}
            onConfirm={async () => {
              await deleteFolder(folderId);
              router.push('/projects');
            }}
          />
        )}

        <Dialog
          open={!!templateSource}
          onOpenChange={(open) => {
            if (!open) setTemplateSource(null);
          }}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Bewaar als template</DialogTitle>
            </DialogHeader>
            <p>
              Er wordt een losstaande kopie van dit project opgeslagen als
              template. Latere wijzigingen aan het project of de template
              beïnvloeden elkaar niet.
            </p>
            <div className="space-y-2">
              <label htmlFor="template-name" className="text-sm font-medium">
                Templatenaam
              </label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Naam"
              />
            </div>
            <Button
              onClick={() => saveAsTemplate()}
              disabled={templateSaving || !templateName.trim()}>
              {templateSaving ? 'Bezig met opslaan' : 'Opslaan'}
            </Button>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </div>
  );
}
