export type FolderLike = { id: number; name: string };

export type ProjectLike = {
  id: number;
  createdAt?: string;
  folderId?: number | null;
  [key: string]: any;
};

export type FolderRow<F extends FolderLike> = { folder: F; count: number };

type GroupOptions = {
  folderId?: number | null;
  hasSearch?: boolean;
  isAdmin?: boolean;
};

export function sortNewestFirst<P extends ProjectLike>(projects: P[]): P[] {
  const time = (p: P) => {
    const value = p?.createdAt ? new Date(p.createdAt).getTime() : 0;
    return Number.isNaN(value) ? 0 : value;
  };
  return [...projects].sort((a, b) => time(b) - time(a));
}

export function groupProjectsByFolder<
  P extends ProjectLike,
  F extends FolderLike,
>(
  projects: P[],
  folders: F[],
  { folderId = null, hasSearch = false, isAdmin = false }: GroupOptions = {}
): { folders: FolderRow<F>[]; projects: P[] } {
  const sorted = sortNewestFirst(projects || []);

  if (hasSearch) return { folders: [], projects: sorted };

  if (folderId !== null && folderId !== undefined) {
    return {
      folders: [],
      projects: sorted.filter((p) => p.folderId === folderId),
    };
  }

  const knownFolderIds = new Set((folders || []).map((f) => f.id));
  const counts = new Map<number, number>();
  const loose: P[] = [];

  for (const project of sorted) {
    if (project.folderId != null && knownFolderIds.has(project.folderId)) {
      counts.set(project.folderId, (counts.get(project.folderId) || 0) + 1);
    } else {
      loose.push(project);
    }
  }

  const rows = [...(folders || [])]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((folder) => ({ folder, count: counts.get(folder.id) || 0 }))
    .filter((row) => isAdmin || row.count > 0);

  return { folders: rows, projects: loose };
}
