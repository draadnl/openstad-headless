// Pure planners for demo seed steps 7-9: compare stored data with the wanted data.
const { DEMO_FILES } = require('./demo-upload-files');
const {
  demoImageChoice,
  demoDropdownAnswer,
  demoDocuments,
  demoPhotoUploads,
  IMAGE_LABELS,
  sameJson,
} = require('./demo-varied-answers');

const IMAGE_OPTION_SLUGS = [
  'demo-optie-park',
  'demo-optie-plein',
  'demo-optie-speeltuin',
];
const PHOTO_SLUGS = DEMO_FILES.filter((f) =>
  f.slug.startsWith('demo-buurtfoto-')
).map((f) => f.slug);
const DOCUMENT_SLUGS = DEMO_FILES.filter((f) => f.kind === 'document').map(
  (f) => f.slug
);

const buildImageOptions = (urls) =>
  IMAGE_LABELS.map((key, i) => ({
    trigger: `img-${i}`,
    titles: [{ key, image: urls[IMAGE_OPTION_SLUGS[i]] }],
  }));

// Answers for the third pass, by submission index. q14 is optional.
function lastAnswers(i, urls) {
  const data = {
    q12: demoImageChoice(i),
    q13: demoDropdownAnswer(i),
  };
  const documents = demoDocuments(
    i,
    DOCUMENT_SLUGS.map((slug) => urls[slug])
  );
  if (documents) data.q14 = documents;
  return data;
}

// Step 7: q12/q13/q14 per row. Returns [{ index, changed }] for rows that differ.
function planLastAnswerChanges(rows, urls) {
  const plan = [];
  rows.forEach((data, index) => {
    const stored = data || {};
    const wanted = lastAnswers(index, urls);
    const changed = {};
    for (const key of Object.keys(wanted)) {
      if (!sameJson(stored[key], wanted[key])) changed[key] = wanted[key];
    }
    if (Object.keys(changed).length > 0) plan.push({ index, changed });
  });
  return plan;
}

// Step 8: q11 photo uploads. Returns [{ index, next }] with the full next row data.
function planPhotoChanges(rows, photoUrls) {
  const plan = [];
  rows.forEach((data, index) => {
    const stored = data || {};
    const wanted = demoPhotoUploads(index, photoUrls);
    if (sameJson(stored.q11, wanted)) return;
    const next = { ...stored };
    if (wanted) next.q11 = wanted;
    else delete next.q11;
    plan.push({ index, next });
  });
  return plan;
}

// Step 9: the q12 item gets the uploaded option images.
function planImageOptionItems(items, urls) {
  const wantedOptions = buildImageOptions(urls);
  let updated = 0;
  const next = (items || []).map((item) => {
    if (item.fieldKey !== 'q12' || sameJson(item.options, wantedOptions)) {
      return item;
    }
    updated += 1;
    return { ...item, options: wantedOptions };
  });
  return { items: next, updated };
}

// Neutral placeholder video (Blender), also written over an older URL in an existing item.
const DEMO_VIDEO_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

// Step 10: the video-1 item gets the neutral video URL; 0 updates when it already has it.
function planVideoItems(items) {
  let updated = 0;
  const next = (items || []).map((item) => {
    if (item.trigger !== 'video-1' || item.videoUrl === DEMO_VIDEO_URL) {
      return item;
    }
    updated += 1;
    return { ...item, videoUrl: DEMO_VIDEO_URL };
  });
  return { items: next, updated };
}

module.exports = {
  DEMO_VIDEO_URL,
  planVideoItems,
  IMAGE_OPTION_SLUGS,
  PHOTO_SLUGS,
  DOCUMENT_SLUGS,
  buildImageOptions,
  lastAnswers,
  planLastAnswerChanges,
  planPhotoChanges,
  planImageOptionItems,
};
