const pad = (n: number) => String(n).padStart(2, '0');

export function formatIsoDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

export function countIssuesByProject(
  issues: any[] | undefined
): Record<number, number> {
  const counts: Record<number, number> = {};
  if (!Array.isArray(issues)) return counts;
  for (const entry of issues) {
    const id = entry?.id;
    if (typeof id !== 'number' || Number.isNaN(id)) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export function withOverviewCounts<T extends { id: number }>(
  projects: T[] | undefined,
  issueCounts: Record<number, number>
): (T & { issueCount: number })[] | undefined {
  if (!projects) return projects;
  return projects.map((p) => ({ ...p, issueCount: issueCounts[p.id] ?? 0 }));
}

export function participationLabels(project: any): string[] {
  const labels: string[] = [];
  if (project?.config?.votes?.isActive === true) labels.push('Stemmen');
  if (project?.config?.comments?.canComment === true) labels.push('Reacties');
  if (project?.config?.resources?.canAddNewResources === true)
    labels.push('Inzendingen');
  return labels;
}
