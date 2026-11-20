import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  DOCUMENT_SLUGS,
  IMAGE_OPTION_SLUGS,
  PHOTO_SLUGS,
  buildImageOptions,
  planLastAnswerChanges,
  planPhotoChanges,
  planImageOptionItems,
  planVideoItems,
  DEMO_VIDEO_URL,
} = require('./demo-seed-plan');

const TOTAL = 192;
const UUID = '123e4567-e89b-12d3-a456-426614174000';
const makeUrls = () => {
  const urls = {};
  [...PHOTO_SLUGS, ...IMAGE_OPTION_SLUGS].forEach((slug) => {
    urls[slug] = `http://localhost:31450/image/${slug}-${UUID}_png`;
  });
  DOCUMENT_SLUGS.forEach((slug) => {
    urls[slug] = `http://localhost:31450/document/${slug}-${UUID}_pdf`;
  });
  return urls;
};

const reverseKeys = (value) => {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value)
      .reverse()
      .forEach((k) => {
        out[k] = reverseKeys(value[k]);
      });
    return out;
  }
  return value;
};

const applyAll = (rows, urls) => {
  const photoUrls = PHOTO_SLUGS.map((s) => urls[s]);
  let next = rows.map((r, i) => {
    const change = planLastAnswerChanges(rows, urls).find((c) => c.index === i);
    return change ? { ...r, ...change.changed } : r;
  });
  const photoPlan = planPhotoChanges(next, photoUrls);
  next = next.map((r, i) => {
    const c = photoPlan.find((p) => p.index === i);
    return c ? c.next : r;
  });
  return next;
};

describe('demo seed plan', () => {
  const urls = makeUrls();
  const photoUrls = PHOTO_SLUGS.map((s) => urls[s]);
  const emptyRows = Array.from({ length: TOTAL }, () => ({ q1: 'x' }));
  const emptyItems = [
    { fieldKey: 'q12', options: [] },
    { fieldKey: 'q1' },
    {
      trigger: 'video-1',
      questionType: 'video',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  ];

  it('second plan run reports zero changes', () => {
    expect(planLastAnswerChanges(emptyRows, urls).length).toBeGreaterThan(0);
    expect(planPhotoChanges(emptyRows, photoUrls).length).toBeGreaterThan(0);
    const first = planImageOptionItems(emptyItems, urls);
    expect(first.updated).toBe(1);

    const applied = applyAll(emptyRows, urls);
    expect(planLastAnswerChanges(applied, urls)).toHaveLength(0);
    expect(planPhotoChanges(applied, photoUrls)).toHaveLength(0);
    expect(planImageOptionItems(first.items, urls).updated).toBe(0);

    // The video item: updated once, then 0 changes (also with reversed keys).
    const video = planVideoItems(first.items);
    expect(video.updated).toBe(1);
    expect(video.items[2].videoUrl).toBe(DEMO_VIDEO_URL);
    expect(DEMO_VIDEO_URL).toBe('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    expect(planVideoItems(video.items).updated).toBe(0);
    expect(planVideoItems(reverseKeys(video.items)).updated).toBe(0);

    const reversed = reverseKeys(applied);
    expect(planLastAnswerChanges(reversed, urls)).toHaveLength(0);
    expect(planPhotoChanges(reversed, photoUrls)).toHaveLength(0);
    expect(planImageOptionItems(reverseKeys(first.items), urls).updated).toBe(
      0
    );
  });

  it('keeps q12 titles stored as {image, key} unchanged', () => {
    const items = [
      {
        fieldKey: 'q12',
        options: buildImageOptions(urls).map((o) => ({
          ...o,
          titles: [{ image: o.titles[0].image, key: o.titles[0].key }],
        })),
      },
    ];
    expect(planImageOptionItems(items, urls).updated).toBe(0);
  });

  it('changing one photo URL changes only rows that use it', () => {
    const applied = applyAll(emptyRows, urls);
    const changedUrls = {
      ...urls,
      [PHOTO_SLUGS[0]]: `http://localhost:31450/image/${PHOTO_SLUGS[0]}-aaaaaaaa-4000-4000-8000-000000000000_png`,
    };
    const plan = planPhotoChanges(
      applied,
      PHOTO_SLUGS.map((s) => changedUrls[s])
    );
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThan(TOTAL);
    for (const { index } of plan) {
      expect(JSON.stringify(applied[index].q11)).toContain(
        urls[PHOTO_SLUGS[0]]
      );
    }
  });
});
