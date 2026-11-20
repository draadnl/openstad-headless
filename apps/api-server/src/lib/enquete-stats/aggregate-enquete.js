const sanitizeHtml = require('sanitize-html');

// Turns saved survey answers into counts per option. Never exposes who answered.

const SINGLE_CHOICE_TYPES = ['multiplechoice', 'dropdown'];
const MULTI_CHOICE_TYPES = ['multiple'];

const OTHER_LABEL = 'Overig';
const LATEST_ANSWERS = 3;
const MAX_ANSWER_LENGTH = 500;
// Max answers shown per card (one short line each).
const OPEN_ANSWER_PREVIEW_CHARS = 60;

// Open questions with these variants hold personal data: we only count them.
const PERSONAL_DATA_VARIANTS = [
  'email',
  'name',
  'given-name',
  'family-name',
  'tel',
  'postal-code',
  'street-address',
  'address-level2',
];

function isPersonalDataItem(item) {
  return (
    !!item &&
    item.questionType === 'open' &&
    PERSONAL_DATA_VARIANTS.includes(item.variant)
  );
}

// Titles are saved as HTML (rich text editor); we want plain text.
function plainTitle(raw) {
  return sanitizeHtml(String(raw || ''), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return String(value).trim().toLowerCase();
}

// Largest-remainder rounding so the percentages sum to 100.
function toPercentages(counts) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return counts.map(() => 0);

  const raw = counts.map((count) => (count / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);

  for (let i = 0; left > 0 && i < order.length; i++, left--) {
    floors[order[i].index] += 1;
  }
  return floors;
}

function isEmptyValue(raw) {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text === '' || text === '[]' || text === '{}';
  }
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'object') return Object.keys(raw).length === 0;
  return false;
}

function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // not JSON: fall through and treat it as one plain value
      }
    }
    return [text];
  }
  return [raw];
}

// Chosen values as trimmed strings, or null when not answered.
function normalizeAnswer(item, raw) {
  if (isEmptyValue(raw)) return null;

  const list = parseList(raw)
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).trim())
    .filter((value) => value !== '');

  return list.length > 0 ? list : null;
}

// Answer options in config order (old image questions only have key1/key2).
function choiceKeys(item) {
  const fromOptions = (item.options || [])
    .map((option) => option && option.titles && option.titles[0])
    .filter((title) => title && title.key !== undefined && title.key !== '')
    .map((title) => String(title.key));
  if (fromOptions.length > 0) return fromOptions;

  if (item.questionType === 'images') {
    return [item.key1, item.key2]
      .filter((key) => key !== undefined && key !== null && key !== '')
      .map(String);
  }
  return [];
}

// Scale steps 1..n. Mode: numbers, smileys, custom, or legacy showSmileys.
function scaleLabels(item) {
  const display =
    item.scaleDisplay || (item.showSmileys ? 'smileys' : 'numbers');

  if (display === 'custom') {
    const steps = Array.isArray(item.scaleSteps) ? item.scaleSteps : [];
    const count = Math.max(steps.length, 2);
    return Array.from({ length: count }, (_, index) => {
      const label = steps[index] && steps[index].label;
      return label ? String(label) : String(index + 1);
    });
  }
  if (display === 'smileys') {
    return ['1', '2', '3', '4', '5'];
  }
  const count = Number(item.scaleStepCount);
  const steps =
    Number.isInteger(count) && count >= 2 && count <= 10 ? count : 5;
  return Array.from({ length: steps }, (_, index) => String(index + 1));
}

// Counts how often each key was picked. Unknown values go in one "Overig" row.
function countChoices(item, submissions, keys, labels, multiple) {
  const lookup = new Map();
  const counts = keys.map(() => 0);
  keys.forEach((key, index) => {
    const normalized = normalizeKey(key);
    if (!lookup.has(normalized)) lookup.set(normalized, index);
  });

  let otherCount = 0;
  let answeredCount = 0;

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    let values = normalizeAnswer(item, data[item.fieldKey]);
    if (!values) continue;
    if (!multiple) values = values.slice(0, 1);

    answeredCount += 1;
    // One person ticking the same option twice still counts once.
    const seen = new Set();
    for (const value of values) {
      const index = lookup.get(normalizeKey(value));
      const id = index === undefined ? `other:${normalizeKey(value)}` : index;
      if (seen.has(id)) continue;
      seen.add(id);
      if (index === undefined) otherCount += 1;
      else counts[index] += 1;
    }
  }

  const rows = keys.map((key, index) => ({
    label: labels ? labels[index] : String(key),
    count: counts[index],
  }));
  if (otherCount > 0) rows.push({ label: OTHER_LABEL, count: otherCount });

  // Percentage of the people who answered (single choice sums to 100).
  const percentages = multiple
    ? rows.map((row) =>
        answeredCount === 0 ? 0 : Math.round((row.count / answeredCount) * 100)
      )
    : toPercentages(rows.map((row) => row.count));

  return {
    answeredCount,
    options: rows.map((row, index) => ({
      ...row,
      percentage: percentages[index],
    })),
  };
}

function cut(text) {
  return text.length > MAX_ANSWER_LENGTH
    ? `${text.slice(0, MAX_ANSWER_LENGTH)}…`
    : text;
}

function previewText(text) {
  return text.length > OPEN_ANSWER_PREVIEW_CHARS
    ? `${text.slice(0, OPEN_ANSWER_PREVIEW_CHARS).trimEnd()}…`
    : text;
}

function buildOpen(item, submissions) {
  const personal = isPersonalDataItem(item);
  const answers = [];

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const raw = data[item.fieldKey];
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const text = String(raw).trim();
    if (text === '') continue;
    answers.push({ text, createdAt: submission.createdAt, id: submission.id });
  }

  const result = { answeredCount: answers.length };
  // The admin uses this flag to hide "Meer details" for such questions.
  if (personal) return { ...result, personalData: true };

  const time = (value) => (value ? new Date(value).getTime() : 0);
  answers.sort(
    (a, b) =>
      time(b.createdAt) - time(a.createdAt) ||
      String(b.id).localeCompare(String(a.id))
  );
  result.latest = answers
    .slice(0, LATEST_ANSWERS)
    .map((a) => previewText(a.text));
  return result;
}

// Turns a saved map answer into a clean {lat,lng} pin, or null.
function parseMapPoint(raw) {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text.startsWith('{')) return null;
    try {
      value = JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const lat = typeof value.lat === 'string' ? Number(value.lat) : value.lat;
  const lng = typeof value.lng === 'string' ? Number(value.lng) : value.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function buildMapSummary(item, submissions) {
  let answeredCount = 0;
  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    if (parseMapPoint(data[item.fieldKey])) answeredCount += 1;
  }
  return { answeredCount };
}

// Matrix cell ids: "rowTrigger_colTrigger", or "rowIndex_colIndex"; one exact lookup per question.
function matrixCellLookup(item) {
  const matrix = item.matrix || {};
  const rows = Array.isArray(matrix.rows) ? matrix.rows : [];
  const columns = Array.isArray(matrix.columns) ? matrix.columns : [];
  const lookup = new Map();
  rows.forEach((row, ri) => {
    columns.forEach((column, ci) => {
      const id =
        column && column.trigger && row && row.trigger
          ? `${row.trigger}_${column.trigger}`
          : `${ri}_${ci}`;
      if (!lookup.has(id)) lookup.set(id, { ri, ci });
    });
  });
  return { rows, columns, lookup };
}

const textOf = (entry, fallback) =>
  entry && entry.text ? plainTitle(entry.text) : fallback;

function buildMatrixStacked(item, submissions) {
  const { rows, columns, lookup } = matrixCellLookup(item);
  const counts = rows.map(() => columns.map(() => 0));
  let answeredCount = 0;

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const raw = data[item.fieldKey];
    if (isEmptyValue(raw)) continue;

    let known = false;
    // The same cell ticked twice still counts once.
    const seen = new Set();
    for (const value of parseList(raw)) {
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const id = String(value).trim();
      const cell = lookup.get(id);
      if (!cell || seen.has(id)) continue;
      seen.add(id);
      counts[cell.ri][cell.ci] += 1;
      known = true;
    }
    if (known) answeredCount += 1;
  }

  const legend = columns.map((column, ci) => textOf(column, String(ci + 1)));
  return {
    answeredCount,
    legend,
    rows: rows.map((row, ri) => {
      const percentages = toPercentages(counts[ri]);
      return {
        label: textOf(row, String(ri + 1)),
        total: counts[ri].reduce((sum, count) => sum + count, 0),
        segments: legend.map((label, ci) => ({
          label,
          count: counts[ri][ci],
          percentage: percentages[ci],
        })),
      };
    }),
  };
}

const FILE_TYPES = ['imageUpload', 'documentUpload'];
const FILE_PREVIEW_COUNT = 5;
const MAX_FILE_NAME_LENGTH = 200;
const MAX_FILES_PER_ROW = 20;
const FALLBACK_FILE_NAME = 'Bestand';

// Links are only kept when they point at our own image server or a plain site path.
function safeFileUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (url === '' || /[\\\s\u0000-\u001f]/.test(url)) return null;

  if (url.startsWith('/')) return url.startsWith('//') ? null : url;

  let imageOrigin = null;
  try {
    imageOrigin = new URL(process.env.IMAGE_APP_URL).origin;
  } catch (e) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.origin === imageOrigin ? url : null;
  } catch (e) {
    return null;
  }
}

function cleanFileName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  return name === '' ? FALLBACK_FILE_NAME : name.slice(0, MAX_FILE_NAME_LENGTH);
}

// Only name and url of an upload leave this file.
function parseFiles(raw) {
  if (isEmptyValue(raw)) return [];
  return parseList(raw)
    .filter((file) => file && typeof file === 'object' && !Array.isArray(file))
    .map((file) => ({
      name: cleanFileName(file.name),
      url: safeFileUrl(file.url),
    }));
}

// Card block: counts plus the 5 newest files.
function buildFilesSummary(item, submissions) {
  const time = (value) => (value ? new Date(value).getTime() : 0);
  let answeredCount = 0;
  let fileCount = 0;
  let preview = [];

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const files = parseFiles(data[item.fieldKey]);
    if (files.length === 0) continue;

    answeredCount += 1;
    fileCount += files.length;
    const key = { t: time(submission.createdAt), id: String(submission.id) };
    files.slice(0, FILE_PREVIEW_COUNT).forEach((file, order) => {
      preview.push({ ...key, order, file });
    });
    // Newest submission first, then stored order; trim right away.
    preview.sort(
      (a, b) => b.t - a.t || b.id.localeCompare(a.id) || a.order - b.order
    );
    preview = preview.slice(0, FILE_PREVIEW_COUNT);
  }

  return {
    answeredCount,
    fileCount,
    preview: preview.map((entry) => entry.file),
  };
}

const SKIPPED_ANSWER = 'skipped';
const SKIPPED_SEGMENT_LABEL = 'Overgeslagen';

// Swipe and dilemma share one shape: a list of {<idKey>, answer}.
function buildAnswerListStacked(item, submissions, config) {
  const options = Array.isArray(item.options) ? item.options : [];
  const rowIndex = new Map();
  options.forEach((option, index) => {
    const id = option && option.trigger;
    if (id !== undefined && id !== null && !rowIndex.has(String(id))) {
      rowIndex.set(String(id), index);
    }
  });
  const answerIndex = new Map(config.answers.map((a, i) => [a, i]));
  answerIndex.set(SKIPPED_ANSWER, config.answers.length);
  const counts = options.map(() => config.answers.map(() => 0).concat(0));
  let answeredCount = 0;

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const raw = data[item.fieldKey];
    if (isEmptyValue(raw) || !Array.isArray(raw)) continue;

    let known = false;
    const seen = new Set();
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const id = String(entry[config.idKey]);
      const row = rowIndex.get(id);
      const answer = String(entry.answer || '')
        .trim()
        .toLowerCase();
      const segment = answerIndex.get(answer);
      // '' means not answered; unknown ids and answers are ignored.
      if (row === undefined || segment === undefined || seen.has(id)) continue;
      seen.add(id);
      counts[row][segment] += 1;
      known = true;
    }
    if (known) answeredCount += 1;
  }

  const rows = options.map((option, index) => {
    const title = (option && option.titles && option.titles[0]) || {};
    const labels = config.segmentLabels(title);
    const percentages = toPercentages(counts[index]);
    const result = {
      label: plainTitle(title.key) || String(index + 1),
      total: counts[index].reduce((sum, count) => sum + count, 0),
      segments: labels.map((label, i) => ({
        label,
        count: counts[index][i],
        percentage: percentages[i],
        ...(i === labels.length - 1 ? { skipped: true } : {}),
      })),
    };
    if (config.sideLabels) result.sideLabels = config.sideLabels(title);
    return result;
  });

  return { answeredCount, rows };
}

function buildSwipeStacked(item, submissions) {
  return {
    ...buildAnswerListStacked(item, submissions, {
      idKey: 'cardId',
      answers: ['eens', 'oneens'],
      segmentLabels: () => ['Eens', 'Oneens', SKIPPED_SEGMENT_LABEL],
    }),
    legend: ['Eens', 'Oneens', SKIPPED_SEGMENT_LABEL],
  };
}

function buildDilemmaStacked(item, submissions) {
  return buildAnswerListStacked(item, submissions, {
    idKey: 'dilemmaId',
    answers: ['a', 'b'],
    segmentLabels: (title) => [
      plainTitle(title.key) || 'A',
      plainTitle(title.key_b) || 'B',
      SKIPPED_SEGMENT_LABEL,
    ],
    sideLabels: (title) => [
      plainTitle(title.key) || 'A',
      plainTitle(title.key_b) || 'B',
    ],
  });
}

// Sort answers are a JSON string of labels in chosen order.
function parseSortAnswer(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function buildSortRanking(item, submissions) {
  const keys = choiceKeys(item);
  const lookup = new Map();
  keys.forEach((key, index) => {
    const normalized = normalizeKey(key);
    if (!lookup.has(normalized)) lookup.set(normalized, index);
  });
  const sums = keys.map(() => 0);
  const counts = keys.map(() => 0);
  let answeredCount = 0;

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const list = parseSortAnswer(data[item.fieldKey]);
    if (!list) continue;

    // Place = position among the known labels; a repeated label keeps its first place.
    const seen = new Set();
    let place = 0;
    for (const value of list) {
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const index = lookup.get(normalizeKey(value));
      if (index === undefined || seen.has(index)) continue;
      seen.add(index);
      place += 1;
      sums[index] += place;
      counts[index] += 1;
    }
    if (place > 0) answeredCount += 1;
  }

  const options = keys
    .map((key, index) => ({
      label: String(key),
      average:
        counts[index] === 0
          ? null
          : Math.round((sums[index] / counts[index]) * 10) / 10,
      count: counts[index],
      index,
    }))
    // Options nobody placed go last; ties keep config order.
    .sort(
      (a, b) =>
        (a.average === null) - (b.average === null) ||
        (a.average ?? 0) - (b.average ?? 0) ||
        a.index - b.index
    )
    .map(({ index, ...rest }) => rest);

  return { answeredCount, options };
}

function buildQuestionSummaries(items, submissions) {
  const questions = [];

  for (const item of items || []) {
    if (!item || !item.fieldKey) continue;
    const type = item.questionType;
    const base = {
      fieldKey: item.fieldKey,
      type,
      title: plainTitle(item.title),
    };

    if (SINGLE_CHOICE_TYPES.includes(type)) {
      questions.push({
        ...base,
        chart: 'donut',
        ...countChoices(item, submissions, choiceKeys(item), null, false),
      });
    } else if (MULTI_CHOICE_TYPES.includes(type)) {
      questions.push({
        ...base,
        chart: 'bar',
        ...countChoices(item, submissions, choiceKeys(item), null, true),
      });
    } else if (type === 'images') {
      const multiple = !!item.multiple;
      questions.push({
        ...base,
        chart: multiple ? 'bar' : 'donut',
        ...countChoices(item, submissions, choiceKeys(item), null, multiple),
      });
    } else if (type === 'scale') {
      const labels = scaleLabels(item);
      const keys = labels.map((_, index) => String(index + 1));
      questions.push({
        ...base,
        chart: 'bar',
        ...countChoices(item, submissions, keys, labels, false),
      });
    } else if (type === 'open') {
      questions.push({
        ...base,
        chart: 'open',
        ...buildOpen(item, submissions),
      });
    } else if (type === 'map') {
      questions.push({
        ...base,
        chart: 'map',
        ...buildMapSummary(item, submissions),
      });
    } else if (type === 'matrix') {
      questions.push({
        ...base,
        chart: 'stacked',
        ...buildMatrixStacked(item, submissions),
      });
    } else if (FILE_TYPES.includes(type)) {
      questions.push({
        ...base,
        chart: 'files',
        ...buildFilesSummary(item, submissions),
      });
    } else if (type === 'sort') {
      questions.push({
        ...base,
        chart: 'ranking',
        ...buildSortRanking(item, submissions),
      });
    } else if (type === 'swipe') {
      questions.push({
        ...base,
        chart: 'stacked',
        ...buildSwipeStacked(item, submissions),
      });
    } else if (type === 'dilemma') {
      questions.push({
        ...base,
        chart: 'stacked',
        ...buildDilemmaStacked(item, submissions),
      });
    }
    // none, pagination, video and unknown types get no block.
  }

  return questions;
}

const MAX_PAGE_SIZE = 100;

// Builds per-question lookups; returns a function turning a saved value into text.
function makeDetailAnswer(item) {
  const type = item.questionType;

  if (FILE_TYPES.includes(type)) {
    return (raw) => {
      const names = parseFiles(raw).map((file) => file.name);
      return names.length === 0 ? null : cut(names.join(', '));
    };
  }
  // Rows without a real pin are skipped, same as the card count.
  if (type === 'map') {
    return (raw) => (parseMapPoint(raw) ? 'Locatie gekozen' : null);
  }
  if (type === 'open') {
    return (raw) => {
      if (typeof raw !== 'string' && typeof raw !== 'number') return null;
      const text = String(raw).trim();
      return text === '' ? null : cut(text);
    };
  }

  if (type === 'matrix') {
    const { rows, columns, lookup } = matrixCellLookup(item);
    return (raw) => {
      const picked = rows.map(() => new Set());
      for (const value of parseList(raw)) {
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        const cell = lookup.get(String(value).trim());
        if (cell) picked[cell.ri].add(cell.ci);
      }
      const parts = [];
      rows.forEach((row, ri) => {
        if (picked[ri].size === 0) return;
        const names = [...picked[ri]]
          .sort((a, b) => a - b)
          .map((ci) => textOf(columns[ci], String(ci + 1)));
        parts.push(`${textOf(row, String(ri + 1))}: ${names.join(', ')}`);
      });
      return parts.length === 0 ? null : cut(parts.join('; '));
    };
  }

  if (type === 'sort') {
    const keys = choiceKeys(item);
    const lookup = new Map();
    keys.forEach((key, index) => {
      const normalized = normalizeKey(key);
      if (!lookup.has(normalized)) lookup.set(normalized, index);
    });
    return (raw) => {
      const list = parseSortAnswer(raw);
      if (!list) return null;
      const seen = new Set();
      const parts = [];
      for (const value of list) {
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        const index = lookup.get(normalizeKey(value));
        if (index === undefined || seen.has(index)) continue;
        seen.add(index);
        parts.push(`${parts.length + 1}. ${keys[index]}`);
      }
      return parts.length === 0 ? null : cut(parts.join(', '));
    };
  }

  if (type === 'swipe' || type === 'dilemma') {
    const isSwipe = type === 'swipe';
    const options = Array.isArray(item.options) ? item.options : [];
    const idKey = isSwipe ? 'cardId' : 'dilemmaId';
    const byId = new Map();
    options.forEach((option, index) => {
      const id = option && option.trigger;
      if (id !== undefined && id !== null && !byId.has(String(id))) {
        const title = (option.titles && option.titles[0]) || {};
        byId.set(String(id), {
          index,
          label: plainTitle(title.key) || String(index + 1),
          b: plainTitle(title.key_b) || 'B',
        });
      }
    });
    const answerText = (info, answer) => {
      if (answer === SKIPPED_ANSWER) return SKIPPED_SEGMENT_LABEL;
      if (isSwipe) {
        if (answer === 'eens') return 'Eens';
        if (answer === 'oneens') return 'Oneens';
        return null;
      }
      if (answer === 'a') return info.label;
      if (answer === 'b') return info.b;
      return null;
    };
    return (raw) => {
      if (!Array.isArray(raw)) return null;
      const found = [];
      const seen = new Set();
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const id = String(entry[idKey]);
        const info = byId.get(id);
        const answer = String(entry.answer || '')
          .trim()
          .toLowerCase();
        const text = info && !seen.has(id) ? answerText(info, answer) : null;
        if (text === null) continue;
        seen.add(id);
        found.push({
          index: info.index,
          text: isSwipe ? `${info.label}: ${text}` : text,
        });
      }
      if (found.length === 0) return null;
      found.sort((a, b) => a.index - b.index);
      return cut(found.map((f) => f.text).join('; '));
    };
  }

  const keys = type === 'scale' ? scaleLabels(item) : choiceKeys(item);
  const lookup = new Map(keys.map((key) => [normalizeKey(key), key]));
  const multiple =
    MULTI_CHOICE_TYPES.includes(type) || (type === 'images' && !!item.multiple);
  const known =
    SINGLE_CHOICE_TYPES.includes(type) ||
    MULTI_CHOICE_TYPES.includes(type) ||
    type === 'images' ||
    type === 'scale';

  return (raw) => {
    if (isEmptyValue(raw) || !known) return null;
    const values = normalizeAnswer(item, raw);
    if (!values) return null;
    const shown = (multiple ? values : values.slice(0, 1)).map((value) => {
      if (type === 'scale') {
        const index = Number(value) - 1;
        return keys[index] !== undefined && Number.isInteger(index)
          ? keys[index]
          : OTHER_LABEL;
      }
      return lookup.get(normalizeKey(value)) || OTHER_LABEL;
    });
    return cut(shown.join(', '));
  };
}

// One page of single answers, newest first. Never returns who answered.
function buildQuestionDetails(item, submissions, options = {}) {
  const pageSize = Math.min(
    Math.max(parseInt(options.pageSize, 10) || 25, 1),
    MAX_PAGE_SIZE
  );
  const page = Math.max(parseInt(options.page, 10) || 1, 1);

  const time = (value) => (value ? new Date(value).getTime() : 0);
  const rows = [];
  const detailAnswer = makeDetailAnswer(item);

  for (const submission of submissions) {
    const data = submission.submittedData;
    if (!data || typeof data !== 'object') continue;
    const answer = detailAnswer(data[item.fieldKey]);
    if (answer === null) continue;
    const row = {
      createdAt: submission.createdAt,
      answer,
      _id: String(submission.id),
    };
    if (FILE_TYPES.includes(item.questionType)) {
      row.files = parseFiles(data[item.fieldKey]).slice(0, MAX_FILES_PER_ROW);
    }
    rows.push(row);
  }

  // Newest first by default; order 'asc' flips it (id breaks ties both ways).
  const direction = options.order === 'asc' ? -1 : 1;
  rows.sort(
    (a, b) =>
      direction *
      (time(b.createdAt) - time(a.createdAt) || b._id.localeCompare(a._id))
  );

  const start = (page - 1) * pageSize;
  return {
    total: rows.length,
    page,
    pageSize,
    rows: rows
      .slice(start, start + pageSize)
      .map(({ createdAt, answer, files }) => ({
        createdAt,
        answer,
        ...(files ? { files } : {}),
      })),
  };
}

module.exports = {
  buildQuestionSummaries,
  buildQuestionDetails,
  MAX_PAGE_SIZE,
  OPEN_ANSWER_PREVIEW_CHARS,
  normalizeAnswer,
  parseMapPoint,
  isPersonalDataItem,
  toPercentages,
  safeFileUrl,
  plainTitle,
  SINGLE_CHOICE_TYPES,
  OTHER_LABEL,
};
