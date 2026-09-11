import {
  AgendaItem,
  AgendaItemsEditor,
} from '@/components/agenda-items-editor';
import { useRegisterSave } from '@/components/ui/save-controller';
import useResource from '@/hooks/use-resource';
import useResources from '@/hooks/use-resources';
import { withId } from '@/lib/widget-item-helpers';
import { fillTimelineEndDates } from '@openstad-headless/lib/timeline-dates';
import isEqual from 'lodash/isEqual';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useState } from 'react';

export default function ProjectResourceTimeline() {
  const router = useRouter();
  const { project, id } = router.query;
  const { data: resource, mutate } = useResource(
    project as string,
    id as string
  );
  const { update } = useResources(project as string, {
    includeGlobalTags: true,
    skipFetch: true,
  });

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // The items the save bar compares against. `withId` hands unsaved items a
  // fresh id, so the baseline is kept as a snapshot instead of being derived
  // from the resource on every render.
  const savedItems = React.useRef<AgendaItem[]>([]);

  const itemsInitialized = React.useRef(false);
  useEffect(() => {
    if (!resource || itemsInitialized.current) return;
    itemsInitialized.current = true;
    const seeded = fillTimelineEndDates(
      (resource?.timeline ?? []).map(withId)
    ) as AgendaItem[];
    savedItems.current = seeded;
    setItems(seeded);
    setIsDirty(false);
  }, [resource?.id]);

  function handleItemsChange(next: AgendaItem[]) {
    const filled = fillTimelineEndDates(next) as AgendaItem[];
    setItems(filled);
    setIsDirty(!isEqual(filled, savedItems.current));
  }

  const save = useCallback(async () => {
    if (!id) return;

    const timeline = fillTimelineEndDates(items) as AgendaItem[];
    await update(Number.parseInt(id as string), { timeline });

    savedItems.current = timeline;
    setIsDirty(false);
    itemsInitialized.current = false;
    await mutate();
  }, [id, items, update, mutate]);

  useRegisterSave({ isDirty, save });

  if (!resource) return null;

  return (
    <div>
      <AgendaItemsEditor
        items={items}
        onItemsChange={handleItemsChange}
        showActiveDates={true}
        timelineMode={true}
      />
    </div>
  );
}
