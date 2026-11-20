import { isImageFile } from './enquete-chart-helpers';

export type ViewerImage = { name: string; url: string | null };

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

// Collects every image of one upload question by paging through the details endpoint.
export async function fetchAllEnqueteImages({
  project,
  widgetId,
  fieldKey,
  from,
  to,
  signal,
}: {
  project: string | string[] | undefined;
  widgetId: string;
  fieldKey: string;
  from: string;
  to: string;
  signal?: AbortSignal;
}): Promise<ViewerImage[]> {
  const images: ViewerImage[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      fieldKey,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      from,
      to,
      order: 'desc',
    });
    const res = await fetch(
      `/api/openstad/stats/project/${project}/enquete/${widgetId}/details?${params}`,
      { signal }
    );
    if (!res.ok) throw new Error('Failed to fetch images');
    const data = await res.json();
    for (const row of data.rows ?? []) {
      for (const file of row.files ?? []) {
        if (isImageFile(file)) images.push(file);
      }
    }
    if (page * PAGE_SIZE >= (data.total ?? 0)) break;
  }
  return images;
}
