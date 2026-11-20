// Demo survey for the enquete statistics tab (project 2).
require('dotenv').config();
const db = require('../src/db');
const {
  DEMO_AREA_RING: AREA_RING,
  insideRing,
  buildDemoPins,
} = require('../src/lib/enquete-stats/demo-map-pins');
const {
  ensureDemoUploads,
} = require('../src/lib/enquete-stats/demo-upload-files');
const {
  PHOTO_SLUGS,
  buildImageOptions,
  planLastAnswerChanges,
  planPhotoChanges,
  planImageOptionItems,
  planVideoItems,
  DEMO_VIDEO_URL,
} = require('../src/lib/enquete-stats/demo-seed-plan');
const { demoSortOrder } = require('../src/lib/enquete-stats/demo-sort-answers');
const {
  demoScaleAnswer,
  demoMatrixAnswer,
  demoSwipeAnswers,
  demoDilemmaAnswers,
  demoPhotoUploads,
  DROPDOWN_LABELS,
  sameJson,
} = require('../src/lib/enquete-stats/demo-varied-answers');

const PROJECT_ID = 2;
const TOTAL = 192;
const WIDGET_DESCRIPTION = 'Enquête buurttevredenheid Oosterhout (demo)';
const AREA_NAME = 'Demo enquête-gebied';

const choice = (labels) =>
  labels.map((key, i) => ({ trigger: `opt-${i}`, titles: [{ key }] }));

const Q1 = {
  labels: [
    'Heel tevreden',
    'Tevreden',
    'Neutraal',
    'Ontevreden',
    'Heel ontevreden',
  ],
  counts: [41, 87, 38, 19, 7],
};
const Q2 = {
  labels: ['Dagelijks', 'Wekelijks', 'Maandelijks', 'Nooit'],
  counts: [104, 58, 21, 9],
};
const Q3 = {
  labels: [
    'Meer groen',
    'Veiliger verkeer',
    'Schonere straten',
    'Speelplekken voor kinderen',
    'Plekken om elkaar te ontmoeten',
    'Betere verlichting',
    'Meer bankjes en schaduw',
    'Anders',
  ],
  counts: [112, 96, 71, 48, 63, 39, 52, 15],
};

const items = [
  {
    trigger: 'q1',
    key: 'q1',
    fieldKey: 'q1',
    questionType: 'multiplechoice',
    title: 'Hoe tevreden bent u over uw buurt als plek om te wonen?',
    options: choice(Q1.labels),
  },
  {
    trigger: 'q2',
    key: 'q2',
    fieldKey: 'q2',
    questionType: 'multiplechoice',
    title: 'Hoe vaak gebruikt u de speeltuin of het park in uw buurt?',
    options: choice(Q2.labels),
  },
  {
    trigger: 'q3',
    key: 'q3',
    fieldKey: 'q3',
    questionType: 'multiple',
    title: 'Wat vindt u het belangrijkst om te verbeteren? Kies uw top 3:',
    options: choice(Q3.labels),
  },
  {
    trigger: 'q4',
    key: 'q4',
    fieldKey: 'q4',
    questionType: 'map',
    title: 'Waar zou u graag een nieuwe speelplek zien?',
  },
  {
    trigger: 'q5',
    key: 'q5',
    fieldKey: 'q5',
    questionType: 'open',
    title: 'Wat hoop je voornamelijk te leren of uit deze workshop te halen?',
  },
  {
    trigger: 'q6',
    key: 'q6',
    fieldKey: 'q6',
    questionType: 'scale',
    scaleDisplay: 'numbers',
    scaleStepCount: 5,
    title: 'Welk cijfer geeft u de leefbaarheid van uw buurt?',
  },
];

const MATRIX_ROWS = ['Groen', 'Verlichting', 'Speelplekken'];
const MATRIX_COLUMNS = ['Goed', 'Matig', 'Slecht'];
const SORT_LABELS = ['Parkeren', 'Groen', 'Verkeersveiligheid', 'Verlichting'];
const SWIPE_CARDS = ['Fietspad', 'Extra bankjes', 'Autovrije straat'];
const DILEMMAS = [
  ['Meer groen', 'Meer parkeerplekken'],
  ['Minder verkeer', 'Snellere doorstroming'],
];

const extraItems = [
  {
    trigger: 'q7',
    key: 'q7',
    fieldKey: 'q7',
    questionType: 'matrix',
    matrixMultiple: false,
    title: 'Hoe beoordeelt u de volgende onderdelen van uw buurt?',
    matrix: {
      rows: MATRIX_ROWS.map((text, i) => ({ trigger: `r${i}`, text })),
      columns: MATRIX_COLUMNS.map((text, i) => ({ trigger: `c${i}`, text })),
    },
  },
  {
    trigger: 'q8',
    key: 'q8',
    fieldKey: 'q8',
    questionType: 'sort',
    title: 'Zet de onderwerpen in volgorde van belang:',
    options: choice(SORT_LABELS),
  },
  {
    trigger: 'q9',
    key: 'q9',
    fieldKey: 'q9',
    questionType: 'swipe',
    title: 'Bent u het eens met deze voorstellen?',
    options: SWIPE_CARDS.map((key, i) => ({
      trigger: `card-${i}`,
      titles: [{ key }],
    })),
  },
  {
    trigger: 'q10',
    key: 'q10',
    fieldKey: 'q10',
    questionType: 'dilemma',
    title: 'Waar kiest u voor?',
    options: DILEMMAS.map(([a, b], i) => ({
      trigger: `dilemma-${i}`,
      titles: [{ key: a, key_b: b }],
    })),
  },
  {
    trigger: 'q11',
    key: 'q11',
    fieldKey: 'q11',
    questionType: 'imageUpload',
    title: 'Upload een foto van een plek die aandacht nodig heeft:',
  },
];

const buildLastItems = (urls) => [
  {
    trigger: 'q12',
    key: 'q12',
    fieldKey: 'q12',
    questionType: 'images',
    multiple: false,
    title: 'Welke plek spreekt u het meest aan?',
    options: buildImageOptions(urls),
  },
  {
    trigger: 'q13',
    key: 'q13',
    fieldKey: 'q13',
    questionType: 'dropdown',
    title: 'In welk deel van de wijk woont u?',
    options: choice(DROPDOWN_LABELS),
  },
  {
    trigger: 'q14',
    key: 'q14',
    fieldKey: 'q14',
    questionType: 'documentUpload',
    title: 'Heeft u een document dat ons kan helpen? Upload het hier:',
  },
  {
    trigger: 'info-1',
    key: 'info-1',
    questionType: 'none',
    title: 'Over deze enquête',
    description:
      'Bedankt voor uw tijd. Uw antwoorden worden anoniem verwerkt en helpen ons de buurt te verbeteren.',
    headingLevel: 3,
    infoBlockStyle: 'default',
  },
  {
    trigger: 'video-1',
    key: 'video-1',
    questionType: 'video',
    title: 'Bekijk de video over de buurt',
    videoUrl: DEMO_VIDEO_URL,
    videoSubtitle: false,
    videoLoop: false,
  },
  {
    trigger: 'page-1',
    key: 'page-1',
    questionType: 'pagination',
    title: 'Pagina',
    prevPageText: 'Vorige',
    nextPageText: 'Volgende',
  },
];

function extraAnswers(i, urls) {
  const data = {};
  data.q7 = demoMatrixAnswer(i);
  data.q8 = JSON.stringify(demoSortOrder(i, SORT_LABELS));
  data.q9 = demoSwipeAnswers(i);
  data.q10 = demoDilemmaAnswers(i);
  const photos = demoPhotoUploads(
    i,
    PHOTO_SLUGS.map((slug) => urls[slug])
  );
  if (photos) data.q11 = photos;
  return data;
}

function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function spread(counts, order) {
  const result = new Array(TOTAL).fill(null).map(() => []);
  counts.forEach((count, optionIndex) => {
    const offset = (optionIndex * 37) % TOTAL;
    for (let j = 0; j < count; j++) {
      result[order[(offset + j) % TOTAL]].push(optionIndex);
    }
  });
  return result;
}

function buildSubmissions(widgetId, pins) {
  const random = makeRandom(1714);
  const order = Array.from({ length: TOTAL }, (_, i) => i);
  for (let i = TOTAL - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const single = (counts) => {
    const out = [];
    counts.forEach((count, optionIndex) => {
      for (let i = 0; i < count; i++) out.push(optionIndex);
    });
    return out; // length TOTAL
  };
  const q1 = single(Q1.counts);
  const q2 = single(Q2.counts);
  const q3 = spread(Q3.counts, order);

  const openAnswers = [
    'Hoe bereik ik bewoners',
    'Hoe we op een eerlijke en objectieve wijze de democratische meerderheid over alle meningen kunnen bepalen',
    'Hoe we op een objectieve en eerlijke wijze de democratische meerderheidsstandpunten kunnen vinden',
  ];

  const start = Date.UTC(2026, 8, 12);
  const days = 31; // 12 Sep .. 12 Oct

  return Array.from({ length: TOTAL }, (_, i) => {
    const slot = order[i];
    const day = i % days;
    const createdAt = new Date(
      start + day * 86400000 + (8 + (i % 12)) * 3600000 + (i % 60) * 60000
    );

    const data = {
      q1: Q1.labels[q1[slot]],
      q2: Q2.labels[q2[slot]],
      q3: JSON.stringify(q3[i].map((idx) => Q3.labels[idx])),
      q4: pins[i],
      q6: demoScaleAnswer(i),
    };
    if (i < 30) data.q5 = openAnswers[i % openAnswers.length];

    return {
      projectId: PROJECT_ID,
      widgetId,
      status: 'approved',
      isSpam: false,
      submittedData: data,
      createdAt,
      updatedAt: createdAt,
    };
  });
}

let uploadUrls = {};

async function run() {
  const project = await db.Project.findByPk(PROJECT_ID);
  if (!project) {
    console.error(`Project ${PROJECT_ID} does not exist`);
    process.exit(1);
  }

  // Step 0: upload placeholder files before any DB write.
  const existingWidget = await db.Widget.findOne({
    where: {
      projectId: PROJECT_ID,
      type: 'enquete',
      description: WIDGET_DESCRIPTION,
    },
  });
  const storedUrls = [];
  if (existingWidget) {
    const widgetItems = (existingWidget.config || {}).items || [];
    for (const item of widgetItems) {
      for (const option of item.options || []) {
        for (const title of option.titles || []) {
          if (title && title.image) storedUrls.push(title.image);
        }
      }
    }
    const existingRows = await db.Submission.findAll({
      where: { projectId: PROJECT_ID, widgetId: existingWidget.id },
    });
    for (const row of existingRows) {
      const data = row.submittedData || {};
      for (const key of ['q11', 'q14']) {
        if (Array.isArray(data[key])) {
          for (const file of data[key])
            if (file && file.url) storedUrls.push(file.url);
        }
      }
    }
  }
  const uploadBase =
    process.env.IMAGE_APP_URL_INTERNAL ||
    process.env.IMAGE_APP_URL ||
    'http://localhost:31450';
  let uploadResult;
  try {
    uploadResult = await ensureDemoUploads({
      storedUrls,
      uploadBase,
      // Token may be undefined: only needed when a file must really be uploaded
      token: process.env.IMAGE_VERIFICATION_TOKEN,
    });
  } catch (err) {
    console.error(
      `Uploaden naar de image-server (${uploadBase}) mislukt: ${err.message}. Er is niets gewijzigd.`
    );
    process.exit(1);
  }
  uploadUrls = uploadResult.urls;
  console.log(
    `Step 0: uploads ${uploadResult.uploaded} new, ${uploadResult.reused} reused`
  );

  const pins = buildDemoPins({ ring: AREA_RING, total: TOTAL });
  let area = await db.Area.findOne({ where: { name: AREA_NAME } });
  if (area) {
    const polygon = area.polygon || [];
    const ring = Array.isArray(polygon[0]) ? polygon[0] : [];
    const containsPins =
      ring.length > 0 && pins.every((pin) => insideRing(pin, ring));
    if (!containsPins) {
      console.error(
        `Area "${AREA_NAME}" exists but does not contain the demo pins. Not touching it.`
      );
      process.exit(1);
    }
    console.log(`Area exists: ${area.id}`);
  } else {
    area = await db.Area.create({
      name: AREA_NAME,
      polygon: [[...AREA_RING, AREA_RING[0]]],
    });
    console.log(`Created area ${area.id}`);
  }

  let widget = await db.Widget.findOne({
    where: {
      projectId: PROJECT_ID,
      type: 'enquete',
      description: WIDGET_DESCRIPTION,
    },
  });
  console.log(widget ? `Widget exists: ${widget.id}` : 'Widget not found');

  if (!widget) {
    widget = await db.Widget.create({
      projectId: PROJECT_ID,
      type: 'enquete',
      description: WIDGET_DESCRIPTION,
      config: { items },
    });
    console.log(`Created widget ${widget.id}`);
  }

  const existing = await db.Submission.count({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
  });
  console.log(`Existing submissions: ${existing}`);

  if (existing === TOTAL) {
    console.log('Nothing to do.');
  } else if (existing > 0) {
    // A half-filled demo would give counts that do not match the design.
    console.error(
      `Found ${existing} submissions, expected 0 or ${TOTAL}. Not touching them.`
    );
    process.exit(1);
  } else {
    await db.Submission.bulkCreate(buildSubmissions(widget.id, pins));
    console.log(`Created ${TOTAL} submissions`);
  }

  const config = widget.config || {};
  if (Array.isArray(config.allowedPolygons) && config.allowedPolygons.length) {
    console.log('allowedPolygons already set, not changing');
  } else {
    widget.config = {
      ...config,
      allowedPolygons: [{ id: area.id, name: area.name }],
    };
    widget.changed('config', true);
    await widget.save();
    console.log(`allowedPolygons set to area ${area.id}`);
  }

  const rows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  const samePin = (a, b) =>
    a && b && Number(a.lat) === b.lat && Number(a.lng) === b.lng;
  const needsRewrite =
    rows.length === TOTAL &&
    rows.some((row, i) => !samePin((row.submittedData || {}).q4, pins[i]));
  if (needsRewrite) {
    // Never write pins that fall outside the area as it is stored now.
    const storedRing = (area.polygon || [])[0] || [];
    if (!pins.every((pin) => insideRing(pin, storedRing))) {
      console.error('New pins are not all inside the stored area. Stopping.');
      process.exit(1);
    }
    for (let i = 0; i < rows.length; i++) {
      await db.Submission.update(
        { submittedData: { ...rows[i].submittedData, q4: pins[i] } },
        { where: { id: rows[i].id }, silent: true }
      );
    }
    console.log(`Rewrote q4 of ${rows.length} submissions`);
  } else {
    console.log('pins already match, q4 untouched');
  }

  const current = widget.config || {};
  const currentItems = Array.isArray(current.items) ? current.items : [];
  const missingItems = extraItems.filter(
    (extra) => !currentItems.some((item) => item.fieldKey === extra.fieldKey)
  );
  if (missingItems.length > 0) {
    widget.config = { ...current, items: [...currentItems, ...missingItems] };
    widget.changed('config', true);
    await widget.save();
    console.log(`Added ${missingItems.length} extra questions to the widget`);
  } else {
    console.log('extra questions already in the widget');
  }

  // Fresh read: step 3 may just have rewritten q4, and we must not undo that.
  const freshRows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  let extended = 0;
  for (let i = 0; i < freshRows.length; i++) {
    const data = freshRows[i].submittedData || {};
    if (data.q7 !== undefined) continue;
    await db.Submission.update(
      { submittedData: { ...data, ...extraAnswers(i, uploadUrls) } },
      { where: { id: freshRows[i].id }, silent: true }
    );
    extended += 1;
  }
  console.log(`Extended ${extended} submissions with extra answers`);

  const sortRows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  let sortRewritten = 0;
  for (let i = 0; i < sortRows.length; i++) {
    const data = sortRows[i].submittedData || {};
    if (data.q8 === undefined) continue;
    const wanted = JSON.stringify(demoSortOrder(i, SORT_LABELS));
    if (data.q8 === wanted) continue;
    await db.Submission.update(
      { submittedData: { ...data, q8: wanted } },
      { where: { id: sortRows[i].id }, silent: true }
    );
    sortRewritten += 1;
  }
  console.log(`Rewrote q8 of ${sortRewritten} submissions`);

  const variedRows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  let variedRewritten = 0;
  for (let i = 0; i < variedRows.length; i++) {
    const data = variedRows[i].submittedData || {};
    if (data.q7 === undefined) continue;
    const wanted = {
      q6: demoScaleAnswer(i),
      q7: demoMatrixAnswer(i),
      q9: demoSwipeAnswers(i),
      q10: demoDilemmaAnswers(i),
    };
    const changed = {};
    for (const key of Object.keys(wanted)) {
      const same =
        key === 'q6'
          ? String(data[key]) === wanted[key]
          : sameJson(data[key], wanted[key]);
      if (!same) changed[key] = wanted[key];
    }
    if (Object.keys(changed).length === 0) continue;
    await db.Submission.update(
      { submittedData: { ...data, ...changed } },
      { where: { id: variedRows[i].id }, silent: true }
    );
    variedRewritten += 1;
  }
  console.log(`Rewrote varied answers of ${variedRewritten} submissions`);

  const afterStep4 = widget.config || {};
  const itemsNow = Array.isArray(afterStep4.items) ? afterStep4.items : [];
  const lastItems = buildLastItems(uploadUrls);
  const itemsToAdd = lastItems.filter(
    (extra) =>
      !itemsNow.some(
        (item) =>
          (extra.fieldKey && item.fieldKey === extra.fieldKey) ||
          item.trigger === extra.trigger
      )
  );
  if (itemsToAdd.length > 0) {
    widget.config = { ...afterStep4, items: [...itemsNow, ...itemsToAdd] };
    widget.changed('config', true);
    await widget.save();
  }
  console.log(`Step 7: added ${itemsToAdd.length} items to the widget`);

  const lastRows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  const lastPlan = planLastAnswerChanges(
    lastRows.map((row) => row.submittedData || {}),
    uploadUrls
  );
  let lastRewritten = 0;
  for (const { index, changed } of lastPlan) {
    const data = lastRows[index].submittedData || {};
    await db.Submission.update(
      { submittedData: { ...data, ...changed } },
      { where: { id: lastRows[index].id }, silent: true }
    );
    lastRewritten += 1;
  }
  console.log(`Step 7: changed ${lastRewritten} submissions`);

  const photoRows = await db.Submission.findAll({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
    order: [['id', 'ASC']],
  });
  const photoUrls = PHOTO_SLUGS.map((slug) => uploadUrls[slug]);
  const photoPlan = planPhotoChanges(
    photoRows.map((row) => row.submittedData || {}),
    photoUrls
  );
  let q11Rewritten = 0;
  for (const { index, next } of photoPlan) {
    await db.Submission.update(
      { submittedData: next },
      { where: { id: photoRows[index].id }, silent: true }
    );
    q11Rewritten += 1;
  }
  console.log(`Step 8: rewrote q11 on ${q11Rewritten} submissions`);

  const configNow = widget.config || {};
  const { items: updatedItems, updated: q12Updated } = planImageOptionItems(
    configNow.items,
    uploadUrls
  );
  if (q12Updated > 0) {
    widget.config = { ...configNow, items: updatedItems };
    widget.changed('config', true);
    await widget.save();
  }
  console.log(`Step 9: updated ${q12Updated} q12 items`);

  const configVideo = widget.config || {};
  const { items: videoItems, updated: videoUpdated } = planVideoItems(
    configVideo.items
  );
  if (videoUpdated > 0) {
    widget.config = { ...configVideo, items: videoItems };
    widget.changed('config', true);
    await widget.save();
  }
  console.log(`Step 10: updated ${videoUpdated} video items`);

  console.log(
    `Summary: q8 ${sortRewritten}, q6/q7/q9/q10 ${variedRewritten}, step 7 items ${itemsToAdd.length}, step 7 rows ${lastRewritten}, uploads ${uploadResult.uploaded}/${uploadResult.reused} reused, q11 ${q11Rewritten}, q12 ${q12Updated}, video ${videoUpdated} (a rerun must show 0 everywhere)`
  );

  const final = await db.Submission.count({
    where: { projectId: PROJECT_ID, widgetId: widget.id },
  });
  console.log(`Widget ${widget.id}: ${final} submissions`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
