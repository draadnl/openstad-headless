import { validateProjectNumber } from '@/lib/validateProjectNumber';
import useSWR from 'swr';

export default function useArea(areaId?: string) {
  const areaNumber: number | undefined = validateProjectNumber(areaId);

  let url = `/api/openstad/api/area/${areaNumber}`;

  const areaSwr = useSWR(areaNumber ? url : null);

  async function updateArea(
    name: string,
    geoJSON: string,
    hidePolygon = false,
    tagIds: number[] = [],
    tagIdsOutside: number[] = []
  ): Promise<any | null> {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        geoJSON: JSON.parse(geoJSON),
        hidePolygon,
        tagIds,
        tagIdsOutside,
      }),
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  }

  return { ...areaSwr, updateArea };
}
