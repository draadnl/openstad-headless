import { describe, expect, it } from 'vitest';

import { updateWidgetIds } from './widget-config-remap.js';

const noMaps = { widgetMap: {}, resourceMap: {}, tagMap: {}, statusMap: {} };

function copyRemap(config, maps = {}) {
  const { widgetMap, resourceMap, tagMap, statusMap } = { ...noMaps, ...maps };
  const result = JSON.parse(JSON.stringify(config));
  updateWidgetIds(result, widgetMap, resourceMap, tagMap, statusMap, 7, {
    clearUnmappedTagsAndStatuses: true,
  });
  // Round-trip through JSON, because that is what the JSON column stores.
  return JSON.parse(JSON.stringify(result));
}

function duplicationRemap(config, maps = {}) {
  const { widgetMap, resourceMap, tagMap, statusMap } = { ...noMaps, ...maps };
  const result = JSON.parse(JSON.stringify(config));
  updateWidgetIds(result, widgetMap, resourceMap, tagMap, statusMap, 7);
  return result;
}

describe('updateWidgetIds — cross-project copy (clearUnmappedTagsAndStatuses)', () => {
  it('rewrites projectId, including nested inside objects and arrays', () => {
    expect(
      copyRemap({
        projectId: 2,
        tagGroups: [{ type: 'theme', projectId: 2 }],
        resourceOverviewMapWidget: { projectId: 2 },
      })
    ).toEqual({
      projectId: 7,
      tagGroups: [{ type: 'theme', projectId: 7 }],
      resourceOverviewMapWidget: { projectId: 7 },
    });
  });

  it('maps tag ids that exist in the target project and drops the ones that do not', () => {
    expect(
      copyRemap(
        { onlyIncludeTagIds: '10,11,12' },
        { tagMap: { 10: 30, 12: 32 } }
      )
    ).toEqual({ onlyIncludeTagIds: '30,32' });
  });

  it('nulls a tag list when nothing survives, instead of leaving an empty string', () => {
    expect(copyRemap({ onlyIncludeTagIds: '10,11' })).toEqual({
      onlyIncludeTagIds: null,
    });
  });

  it('maps status ids the same way', () => {
    expect(
      copyRemap({ onlyIncludeStatusIds: '5,6' }, { statusMap: { 6: 60 } })
    ).toEqual({ onlyIncludeStatusIds: '60' });
  });

  // This is the regression the substring matching caused: these keys mention
  // tags/statuses but hold a mode or a tag *type*, never an id.
  it('leaves tag/status-adjacent keys that do not hold ids untouched', () => {
    const config = {
      includeOrExcludeTagIds: 'include',
      includeOrExcludeStatusIds: 'exclude',
      includeOrExclude: 'include',
      tagTypeSelector: 'tag',
      tagTypeTag: 'theme',
      displayStatusLabel: true,
      items: [{ type: 'text', tags: 'theme' }],
    };
    expect(copyRemap(config)).toEqual(config);
  });

  it('drops an id field of an unexpected shape instead of passing it through', () => {
    // The admin API stores config without a server-side schema, so these fields
    // can hold an array or object. Nothing can be mapped, and keeping the value
    // would carry source-project ids into the target -- so it is cleared.
    expect(
      copyRemap({
        onlyIncludeTagIds: ['10', '12'],
        onlyIncludeStatusIds: { a: 1 },
      })
    ).toEqual({ onlyIncludeTagIds: null, onlyIncludeStatusIds: null });
  });

  it('clears resourceId to null so the key survives JSON serialization', () => {
    // undefined would be dropped by JSON.stringify, silently handing the key
    // back to the widget registry default instead of storing "not set".
    expect(copyRemap({ resourceId: 41 })).toEqual({ resourceId: null });
  });

  it('remaps widget references to their copies within the same batch', () => {
    expect(
      copyRemap(
        { choiceguideWidgetId: 88, widgetToFetchId: 99 },
        { widgetMap: { 88: 188, 99: 199 } }
      )
    ).toEqual({ choiceguideWidgetId: 188, widgetToFetchId: 199 });
  });

  it('nulls a widget reference that was not part of the batch', () => {
    expect(copyRemap({ choiceguideWidgetId: 88 })).toEqual({
      choiceguideWidgetId: null,
    });
  });
});

describe('updateWidgetIds — project duplication (default options)', () => {
  it('falls back to the source id when a tag is not in the map', () => {
    expect(
      duplicationRemap({ onlyIncludeTagIds: '10,11' }, { tagMap: { 10: 30 } })
    ).toEqual({ onlyIncludeTagIds: '30,11' });
  });

  it('still applies the historical substring matching', () => {
    // Unchanged pre-existing behaviour: the value falls back to itself, so
    // the substring match is harmless here.
    expect(duplicationRemap({ includeOrExcludeTagIds: 'include' })).toEqual({
      includeOrExcludeTagIds: 'include',
    });
  });

  it('preserves empty CSV segments rather than normalizing them away', () => {
    expect(
      duplicationRemap({ onlyIncludeTagIds: '10,,11' }, { tagMap: { 10: 30 } })
    ).toEqual({ onlyIncludeTagIds: '30,,11' });
  });

  it('does not remap widgetToFetchId, which the duplication flow never did', () => {
    expect(
      duplicationRemap({ widgetToFetchId: 99 }, { widgetMap: { 99: 199 } })
    ).toEqual({ widgetToFetchId: 99 });
  });

  it('leaves an unexpected shape untouched, since nothing is cleared here', () => {
    const config = { onlyIncludeTagIds: ['10', '12'] };
    expect(duplicationRemap(config)).toEqual(config);
  });

  it('remaps resourceId to the newly created resource', () => {
    expect(
      duplicationRemap({ resourceId: 41 }, { resourceMap: { 41: 77 } })
    ).toEqual({ resourceId: 77 });
  });

  it('nulls a resourceId that was never recreated, rather than dropping the key', () => {
    // Previously this produced `undefined`, which JSON.stringify removes, so
    // the stored config lost the key entirely and silently fell back to the
    // widget registry default. null records "no resource" explicitly; both
    // render the same, but only one survives a round-trip through the column.
    expect(duplicationRemap({ resourceId: 41 })).toEqual({ resourceId: null });
  });
});
