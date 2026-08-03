// Pure widget-config reference remapping, deliberately free of `db`, `req` and
// `res` so the rules below can be unit tested without a database.

// Config keys that really hold a comma-separated list of tag/status ids.
//
// The project-duplication flow matches these by substring (`key.includes('tag')`),
// which also fires on keys that merely *mention* tags without holding an id --
// `includeOrExcludeTagIds` holds 'include'/'exclude', `tagTypeSelector` holds a
// tag type, `items[].tags` holds a tag type name. That is harmless there because
// an unmapped value falls back to itself, but it is destructive when unmapped
// values are cleared. So the clearing path uses these allowlists instead.
const TAG_ID_KEYS = new Set([
  'onlyIncludeTagIds',
  'onlyIncludeOrExcludeTagIds',
  'onlyShowTheseTagIds',
]);
const STATUS_ID_KEYS = new Set(['onlyIncludeStatusIds']);

// Config keys holding a reference to another widget in the same project.
const WIDGET_ID_KEYS = new Set(['choiceguideWidgetId', 'widgetToFetchId']);

// Remaps one comma-separated id list. Returns the rewritten value, or null when
// clearing is on and nothing survived (so the caller can null the whole key).
function remapIdList(value, idMap, clearUnmapped) {
  const raw = typeof value === 'number' ? value.toString() : value;
  if (typeof raw !== 'string') {
    // Fail closed. The admin API merges req.body.config without a server-side
    // schema, so this field can hold anything. An unrecognised shape cannot be
    // remapped, and passing it through would carry the source project's ids
    // into the target -- so when clearing is on, drop it instead.
    return clearUnmapped ? null : value;
  }
  if (raw === '') return value;

  const mapped = raw
    .split(',')
    .map((id) => idMap[id] || (clearUnmapped ? '' : id))
    .filter((id) => !clearUnmapped || id !== '')
    .join(',');

  return clearUnmapped && mapped === '' ? null : mapped;
}

// Recursively rewrites widget-config references (projectId, resourceId,
// tag/status id lists, widget-to-widget references) using the supplied maps.
//
// options.clearUnmappedTagsAndStatuses: when true, a tag/status id with no
// entry in tagMap/statusMap is dropped instead of falling back to the
// source id, and only the keys in TAG_ID_KEYS/STATUS_ID_KEYS are touched.
// The original project-duplication flow relies on the fallback-to-source-id
// behavior (tags/statuses are always copied alongside the widgets there), so
// it defaults to false and keeps the historical substring matching.
function updateWidgetIds(
  obj,
  widgetMap,
  resourceMap,
  tagMap,
  statusMap,
  projectId,
  options = {}
) {
  const { clearUnmappedTagsAndStatuses = false } = options;

  const isTagKey = (key) =>
    clearUnmappedTagsAndStatuses
      ? TAG_ID_KEYS.has(key)
      : key.includes('tag') || key.includes('Tag');
  const isStatusKey = (key) =>
    clearUnmappedTagsAndStatuses
      ? STATUS_ID_KEYS.has(key)
      : key.includes('status') || key.includes('Status');
  const isWidgetKey = (key) =>
    clearUnmappedTagsAndStatuses
      ? WIDGET_ID_KEYS.has(key)
      : key === 'choiceguideWidgetId';

  for (const key in obj) {
    // An id-list key is a scalar by contract, but the admin API stores config
    // without a server-side schema, so it can hold an array or object. Those
    // must be handled here: recursing into one would walk its entries as if
    // they were config keys and leave the source project's ids in place.
    //
    // Only the allowlist is safe to short-circuit like this. The duplication
    // path matches by substring, where `tagGroups` -- a real array that must be
    // recursed into for its nested projectId -- would be caught by mistake.
    const isMalformedIdList =
      clearUnmappedTagsAndStatuses &&
      typeof obj[key] === 'object' &&
      obj[key] !== null &&
      (TAG_ID_KEYS.has(key) || STATUS_ID_KEYS.has(key));

    if (isMalformedIdList) {
      obj[key] = null;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      updateWidgetIds(
        obj[key],
        widgetMap,
        resourceMap,
        tagMap,
        statusMap,
        projectId,
        options
      );
    } else {
      if (key === 'projectId') {
        obj[key] = projectId;
      }
      if (key === 'resourceId') {
        // null rather than undefined: an undefined value is dropped by
        // JSON.stringify, which silently hands the key back to the widget
        // registry default instead of storing "no resource selected".
        obj[key] = resourceMap[obj[key]] ?? null;
      }
      if (isTagKey(key) && obj[key]) {
        obj[key] = remapIdList(obj[key], tagMap, clearUnmappedTagsAndStatuses);
      }
      if (isStatusKey(key) && obj[key]) {
        obj[key] = remapIdList(
          obj[key],
          statusMap,
          clearUnmappedTagsAndStatuses
        );
      }
      if (isWidgetKey(key)) {
        obj[key] = widgetMap[obj[key]] ?? null;
      }
    }
  }
}

module.exports = {
  updateWidgetIds,
  TAG_ID_KEYS,
  STATUS_ID_KEYS,
  WIDGET_ID_KEYS,
};
