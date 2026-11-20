import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildQuestionSummaries,
  buildQuestionDetails,
  parseMapPoint,
  isPersonalDataItem,
  normalizeAnswer,
  toPercentages,
  safeFileUrl,
  OPEN_ANSWER_PREVIEW_CHARS,
} = require('./aggregate-enquete');

const item = (extra = {}) => ({
  questionType: 'multiplechoice',
  fieldKey: 'q1',
  title: '<p>Hoe <b>tevreden</b>&nbsp;ben u?</p>',
  options: [
    { trigger: 't1', titles: [{ key: 'Ja' }] },
    { trigger: 't2', titles: [{ key: 'Nee' }] },
  ],
  ...extra,
});
const sub = (value) => ({ submittedData: { q1: value } });

describe('buildQuestionSummaries (single choice)', () => {
  it('counts options in config order and strips html from the title', () => {
    const [q] = buildQuestionSummaries(
      [item()],
      [sub('Ja'), sub('Ja'), sub('Nee')]
    );
    expect(q.title).toBe('Hoe tevreden ben u?');
    expect(q.chart).toBe('donut');
    expect(q.answeredCount).toBe(3);
    expect(q.options.map((o) => [o.label, o.count, o.percentage])).toEqual([
      ['Ja', 2, 67],
      ['Nee', 1, 33],
    ]);
  });

  it('works for dropdown', () => {
    const [q] = buildQuestionSummaries(
      [item({ questionType: 'dropdown' })],
      [sub('Nee')]
    );
    expect(q.type).toBe('dropdown');
    expect(q.options[1].count).toBe(1);
  });

  it('matches trimmed and case-insensitive', () => {
    const [q] = buildQuestionSummaries([item()], [sub('  ja '), sub('NEE')]);
    expect(q.options.map((o) => o.count)).toEqual([1, 1]);
  });

  it('puts unknown values in one Overig row', () => {
    const [q] = buildQuestionSummaries(
      [item()],
      [sub('Misschien'), sub('Weet niet'), sub('Ja')]
    );
    const last = q.options[q.options.length - 1];
    expect(last).toMatchObject({ label: 'Overig', count: 2 });
    expect(q.options).toHaveLength(3);
  });

  it('handles zero answers without dividing by zero', () => {
    const [q] = buildQuestionSummaries([item()], [sub(''), sub(undefined), {}]);
    expect(q.answeredCount).toBe(0);
    expect(q.options.every((o) => o.percentage === 0)).toBe(true);
  });

  it('skips non-question types and items without fieldKey', () => {
    expect(
      buildQuestionSummaries(
        [
          item({ questionType: 'pagination' }),
          item({ questionType: 'video' }),
          item({ questionType: 'none' }),
          item({ fieldKey: undefined }),
        ],
        []
      )
    ).toEqual([]);
  });

  it('only returns the documented keys', () => {
    const [q] = buildQuestionSummaries(
      [item()],
      [
        {
          id: 'abc',
          ipAddress: '1.2.3.4',
          userId: 5,
          submittedData: { q1: 'Ja', embeddedUrl: 'x' },
        },
      ]
    );
    expect(JSON.stringify(q)).not.toMatch(/ipAddress|embeddedUrl|userId|abc/);
  });
});

describe('toPercentages', () => {
  it('sums to 100 with largest remainder', () => {
    const result = toPercentages([1, 1, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

const summarize = (it, subs) => buildQuestionSummaries([it], subs)[0];
const arr = (...v) => JSON.stringify(v);

describe('normalizeAnswer', () => {
  it('treats empty values as unanswered', () => {
    for (const raw of [undefined, null, '', '  ', '[]', [], {}]) {
      expect(normalizeAnswer({}, raw)).toBeNull();
    }
  });

  it('parses JSON array strings, also with one choice', () => {
    expect(normalizeAnswer({}, '["A"]')).toEqual(['A']);
    expect(normalizeAnswer({}, '["A"," B "]')).toEqual(['A', 'B']);
    expect(normalizeAnswer({}, 'plain')).toEqual(['plain']);
  });
});

describe('multiple choice and images', () => {
  const options = [
    { trigger: 'a', titles: [{ key: 'Groen' }] },
    { trigger: 'b', titles: [{ key: 'Verkeer' }] },
  ];

  it('counts every ticked option as a bar with raw counts', () => {
    const q = summarize(
      { questionType: 'multiple', fieldKey: 'q1', title: 'T', options },
      [sub(arr('Groen', 'Verkeer')), sub(arr('Groen')), sub('[]')]
    );
    expect(q.chart).toBe('bar');
    expect(q.answeredCount).toBe(2);
    expect(q.options.map((o) => o.count)).toEqual([2, 1]);
  });

  it('does not count a duplicate tick twice', () => {
    const q = summarize(
      { questionType: 'multiple', fieldKey: 'q1', title: 'T', options },
      [sub(arr('Groen', 'groen'))]
    );
    expect(q.options[0].count).toBe(1);
  });

  it('single image choice is a donut even though it is a JSON array', () => {
    const q = summarize(
      { questionType: 'images', fieldKey: 'q1', title: 'T', options },
      [sub(arr('Groen')), sub(arr('Verkeer')), sub(arr('Verkeer'))]
    );
    expect(q.chart).toBe('donut');
    expect(q.answeredCount).toBe(3);
    expect(q.options.map((o) => o.count)).toEqual([1, 2]);
    expect(q.options.some((o) => o.label === 'Overig')).toBe(false);
  });

  it('multi image choice is a bar', () => {
    const q = summarize(
      {
        questionType: 'images',
        multiple: true,
        fieldKey: 'q1',
        title: 'T',
        options,
      },
      [sub(arr('Groen', 'Verkeer'))]
    );
    expect(q.chart).toBe('bar');
    expect(q.options.map((o) => o.count)).toEqual([1, 1]);
  });

  it('supports legacy key1/key2 image questions', () => {
    const q = summarize(
      {
        questionType: 'images',
        fieldKey: 'q1',
        title: 'T',
        key1: 'links',
        key2: 'rechts',
      },
      [sub(arr('links')), sub(arr('rechts')), sub(arr('rechts'))]
    );
    expect(q.options.map((o) => [o.label, o.count])).toEqual([
      ['links', 1],
      ['rechts', 2],
    ]);
  });

  it('counts the "Anders" option as its own option', () => {
    const q = summarize(
      {
        questionType: 'multiple',
        fieldKey: 'q1',
        title: 'T',
        options: [
          ...options,
          { trigger: 'c', titles: [{ key: 'Anders', isOtherOption: true }] },
        ],
      },
      [sub(arr('Anders'))]
    );
    expect(q.options[2]).toMatchObject({ label: 'Anders', count: 1 });
  });
});

describe('scale', () => {
  const scale = (extra) => ({
    questionType: 'scale',
    fieldKey: 'q1',
    title: 'T',
    ...extra,
  });

  it('numbers mode: default 5 steps', () => {
    const q = summarize(scale({ scaleDisplay: 'numbers' }), [
      sub('1'),
      sub('5'),
    ]);
    expect(q.chart).toBe('bar');
    expect(q.options.map((o) => o.label)).toEqual(['1', '2', '3', '4', '5']);
    expect(q.options[4].count).toBe(1);
  });

  it('numbers mode: custom step count', () => {
    const q = summarize(
      scale({ scaleDisplay: 'numbers', scaleStepCount: 7 }),
      []
    );
    expect(q.options).toHaveLength(7);
  });

  it('smileys mode: always 5 steps', () => {
    const q = summarize(
      scale({ scaleDisplay: 'smileys', scaleStepCount: 9 }),
      []
    );
    expect(q.options).toHaveLength(5);
  });

  it('legacy showSmileys flag gives 5 steps', () => {
    const q = summarize(scale({ showSmileys: true }), [sub('3')]);
    expect(q.options).toHaveLength(5);
    expect(q.options[2].count).toBe(1);
  });

  it('custom mode uses the step labels', () => {
    const q = summarize(
      scale({
        scaleDisplay: 'custom',
        scaleSteps: [{ label: 'Slecht' }, {}, { label: 'Goed' }],
      }),
      [sub('3')]
    );
    expect(q.options.map((o) => o.label)).toEqual(['Slecht', '2', 'Goed']);
    expect(q.options[2].count).toBe(1);
  });

  it('puts out-of-range values in Overig', () => {
    const q = summarize(scale({}), [sub('99')]);
    expect(q.options[q.options.length - 1]).toMatchObject({
      label: 'Overig',
      count: 1,
    });
  });
});

describe('open questions', () => {
  const open = (extra) => ({
    questionType: 'open',
    fieldKey: 'q1',
    title: 'T',
    ...extra,
  });
  const at = (day, text, id) => ({
    id,
    createdAt: new Date(`2026-10-${day}T10:00:00Z`),
    submittedData: { q1: text },
  });

  it('returns the 3 newest non-empty answers', () => {
    const q = summarize(open(), [
      at('01', 'oud', 'a'),
      at('04', 'nieuwst', 'd'),
      at('02', '   ', 'b'),
      at('03', 'midden', 'c'),
      at('05', 'allernieuwst', 'e'),
    ]);
    expect(q.chart).toBe('open');
    expect(q.answeredCount).toBe(4);
    expect(q.latest).toEqual(['allernieuwst', 'nieuwst', 'midden']);
  });

  it('cuts long answers to the card preview length', () => {
    const q = summarize(open(), [at('01', 'x'.repeat(900), 'a')]);
    expect(q.latest[0]).toHaveLength(OPEN_ANSWER_PREVIEW_CHARS + 1);
    expect(q.latest[0].endsWith('…')).toBe(true);
  });

  it('does not leave a space before the ellipsis', () => {
    const text = 'x'.repeat(OPEN_ANSWER_PREVIEW_CHARS - 1) + ' tail words';
    const q = summarize(open(), [at('01', text, 'a')]);
    expect(q.latest[0]).toBe('x'.repeat(OPEN_ANSWER_PREVIEW_CHARS - 1) + '…');
  });

  it('personal-data variants only return a count', () => {
    for (const variant of [
      'email',
      'name',
      'given-name',
      'family-name',
      'tel',
      'postal-code',
      'street-address',
      'address-level2',
    ]) {
      const it = open({ variant });
      expect(isPersonalDataItem(it)).toBe(true);
      const q = summarize(it, [at('01', 'geheim@example.org', 'a')]);
      expect(q.answeredCount).toBe(1);
      expect(q).not.toHaveProperty('latest');
      expect(q.personalData).toBe(true);
      expect(JSON.stringify(q)).not.toContain('geheim');
    }
  });

  it('a normal variant is not personal data', () => {
    expect(isPersonalDataItem(open({ variant: 'textarea' }))).toBe(false);
  });
});

describe('unknown types', () => {
  it('get no block', () => {
    expect(
      buildQuestionSummaries(
        [{ questionType: 'mystery', fieldKey: 'q1', title: 'T' }],
        []
      )
    ).toEqual([]);
  });
});

describe('matrix stacked', () => {
  const matrixItem = (extra = {}) => ({
    questionType: 'matrix',
    fieldKey: 'q1',
    title: 'Raster',
    matrixMultiple: false,
    matrix: {
      rows: [
        { trigger: '1', text: 'Groen' },
        { trigger: '10', text: 'Verlichting' },
      ],
      columns: [
        { trigger: 'a', text: 'Goed' },
        { trigger: 'b', text: 'Matig' },
      ],
    },
    ...extra,
  });

  it('gives one stacked row per matrix row with column segments', () => {
    const q = summarize(matrixItem(), [
      { submittedData: { q1: ['1_a', '10_b'] } },
      { submittedData: { q1: ['1_a', '10_a'] } },
      { submittedData: { q1: ['1_b'] } },
    ]);
    expect(q.chart).toBe('stacked');
    expect(q.answeredCount).toBe(3);
    expect(q.legend).toEqual(['Goed', 'Matig']);
    expect(q.rows[0]).toEqual({
      label: 'Groen',
      total: 3,
      segments: [
        { label: 'Goed', count: 2, percentage: 67 },
        { label: 'Matig', count: 1, percentage: 33 },
      ],
    });
    expect(q.rows[1].total).toBe(2);
  });

  it('counts several cells in one row for matrixMultiple', () => {
    const q = summarize(matrixItem({ matrixMultiple: true }), [
      { submittedData: { q1: ['1_a', '1_b'] } },
      { submittedData: { q1: ['1_a'] } },
    ]);
    expect(q.rows[0].total).toBe(3);
    expect(q.rows[0].segments.map((s) => s.count)).toEqual([2, 1]);
  });

  it("does not mix up row '1' and row '10'", () => {
    const q = summarize(matrixItem(), [{ submittedData: { q1: ['10_a'] } }]);
    expect(q.rows[0].total).toBe(0);
    expect(q.rows[1].segments[0].count).toBe(1);
  });

  it('falls back to index ids when triggers are missing', () => {
    const q = summarize(
      matrixItem({
        matrix: {
          rows: [{ text: 'Groen' }, { text: 'Licht' }],
          columns: [{ text: 'Goed' }, { text: 'Matig' }],
        },
      }),
      [{ submittedData: { q1: ['0_1', '1_0'] } }]
    );
    expect(q.rows[0].segments[1].count).toBe(1);
    expect(q.rows[1].segments[0].count).toBe(1);
  });

  it('ignores unknown cells', () => {
    const q = summarize(matrixItem(), [
      { submittedData: { q1: ['9_z', '1_a'] } },
      { submittedData: { q1: ['9_z'] } },
    ]);
    expect(q.answeredCount).toBe(1);
    expect(q.rows[0].total).toBe(1);
  });

  it('handles 0 answers', () => {
    const q = summarize(matrixItem(), [
      { submittedData: {} },
      { submittedData: { q1: '[]' } },
    ]);
    expect(q.answeredCount).toBe(0);
    expect(q.rows[0].segments.map((s) => s.percentage)).toEqual([0, 0]);
  });
});

describe('swipe stacked', () => {
  const swipeItem = {
    questionType: 'swipe',
    fieldKey: 'q1',
    title: 'Swipe',
    options: [
      { trigger: 'c1', titles: [{ key: 'Fietspad' }] },
      { trigger: 'c2', titles: [{ key: 'Bankje' }] },
    ],
  };

  it('counts Eens / Oneens / Overgeslagen per card, skipped last', () => {
    const q = summarize(swipeItem, [
      {
        submittedData: {
          q1: [
            { cardId: 'c1', answer: 'Eens' },
            { cardId: 'c2', answer: 'skipped' },
          ],
        },
      },
      {
        submittedData: {
          q1: [
            { cardId: 'c1', answer: 'oneens' },
            { cardId: 'c2', answer: 'Eens' },
          ],
        },
      },
    ]);
    expect(q.chart).toBe('stacked');
    expect(q.answeredCount).toBe(2);
    expect(q.legend).toEqual(['Eens', 'Oneens', 'Overgeslagen']);
    expect(q.rows[0].label).toBe('Fietspad');
    expect(q.rows[0].segments.map((s) => s.count)).toEqual([1, 1, 0]);
    expect(q.rows[1].segments.map((s) => s.count)).toEqual([1, 0, 1]);
    expect(q.rows[1].segments[2]).toMatchObject({
      label: 'Overgeslagen',
      skipped: true,
    });
  });

  it('ignores unknown card ids and empty answers', () => {
    const q = summarize(swipeItem, [
      { submittedData: { q1: [{ cardId: 'zzz', answer: 'Eens' }] } },
      { submittedData: { q1: [{ cardId: 'c1', answer: '' }] } },
    ]);
    expect(q.answeredCount).toBe(0);
    expect(q.rows[0].total).toBe(0);
  });

  it('handles 0 answers', () => {
    const q = summarize(swipeItem, [{ submittedData: {} }]);
    expect(q.answeredCount).toBe(0);
    expect(q.rows[0].segments.map((s) => s.percentage)).toEqual([0, 0, 0]);
  });
});

describe('dilemma stacked', () => {
  const dilemmaItem = {
    questionType: 'dilemma',
    fieldKey: 'q1',
    title: 'Dilemma',
    options: [
      {
        trigger: 'd1',
        titles: [{ key: 'Meer groen', key_b: 'Meer parkeren' }],
      },
    ],
  };

  it('gives A/B counts, own labels and a grey skipped segment last', () => {
    const q = summarize(dilemmaItem, [
      { submittedData: { q1: [{ dilemmaId: 'd1', answer: 'a' }] } },
      { submittedData: { q1: [{ dilemmaId: 'd1', answer: 'a' }] } },
      { submittedData: { q1: [{ dilemmaId: 'd1', answer: 'b' }] } },
      { submittedData: { q1: [{ dilemmaId: 'd1', answer: 'skipped' }] } },
    ]);
    expect(q.legend).toBeUndefined();
    expect(q.rows[0].sideLabels).toEqual(['Meer groen', 'Meer parkeren']);
    expect(q.rows[0].segments.map((s) => s.count)).toEqual([2, 1, 1]);
    expect(q.rows[0].segments[2].skipped).toBe(true);
    expect(q.rows[0].total).toBe(4);
  });

  it("treats '' answers and unknown ids as not answered", () => {
    const q = summarize(dilemmaItem, [
      { submittedData: { q1: [{ dilemmaId: 'd1', answer: '' }] } },
      { submittedData: { q1: [{ dilemmaId: 'nope', answer: 'a' }] } },
    ]);
    expect(q.answeredCount).toBe(0);
  });

  it('handles 0 answers', () => {
    const q = summarize(dilemmaItem, []);
    expect(q.answeredCount).toBe(0);
    expect(q.rows[0].total).toBe(0);
  });
});

describe('sort ranking', () => {
  const sortItem = {
    questionType: 'sort',
    fieldKey: 'q1',
    title: 'Sorteer',
    options: [
      { trigger: 's1', titles: [{ key: 'Parkeren' }] },
      { trigger: 's2', titles: [{ key: 'Groen' }] },
      { trigger: 's3', titles: [{ key: 'Licht' }] },
    ],
  };
  const answer = (...labels) => ({
    submittedData: { q1: JSON.stringify(labels) },
  });

  it('gives the average place per option, best first', () => {
    const q = summarize(sortItem, [
      answer('Groen', 'Parkeren', 'Licht'),
      answer('Groen', 'Licht', 'Parkeren'),
    ]);
    expect(q.chart).toBe('ranking');
    expect(q.answeredCount).toBe(2);
    expect(q.options).toEqual([
      { label: 'Groen', average: 1, count: 2 },
      { label: 'Parkeren', average: 2.5, count: 2 },
      { label: 'Licht', average: 2.5, count: 2 },
    ]);
  });

  it("treats '' and broken JSON as not answered", () => {
    const q = summarize(sortItem, [
      { submittedData: { q1: '' } },
      { submittedData: { q1: '[broken' } },
      { submittedData: {} },
    ]);
    expect(q.answeredCount).toBe(0);
  });

  it('ignores unknown labels', () => {
    const q = summarize(sortItem, [answer('Onbekend', 'Groen')]);
    expect(q.options[0]).toEqual({ label: 'Groen', average: 1, count: 1 });
  });

  it('counts a duplicate label at its first place', () => {
    const q = summarize(sortItem, [answer('Groen', 'Groen', 'Licht')]);
    const licht = q.options.find((o) => o.label === 'Licht');
    expect(licht.average).toBe(2);
  });

  it('keeps a configured label nobody placed, last, without average', () => {
    const q = summarize(sortItem, [answer('Groen', 'Licht')]);
    expect(q.options[2]).toEqual({
      label: 'Parkeren',
      average: null,
      count: 0,
    });
  });

  it('counts only the labels present in a partial ranking', () => {
    const q = summarize(sortItem, [answer('Licht')]);
    expect(q.answeredCount).toBe(1);
    expect(q.options[0]).toEqual({ label: 'Licht', average: 1, count: 1 });
  });

  it('handles 0 answers', () => {
    const q = summarize(sortItem, []);
    expect(q.answeredCount).toBe(0);
    expect(q.options.every((o) => o.count === 0)).toBe(true);
  });
});

describe('files upload', () => {
  const OLD_ENV = process.env.IMAGE_APP_URL;
  beforeAll(() => {
    process.env.IMAGE_APP_URL = 'https://images.example.com';
  });
  afterAll(() => {
    if (OLD_ENV === undefined) delete process.env.IMAGE_APP_URL;
    else process.env.IMAGE_APP_URL = OLD_ENV;
  });

  const fileItem = {
    questionType: 'imageUpload',
    fieldKey: 'q1',
    title: 'Foto',
  };

  it('keeps image-server urls and one-slash paths', () => {
    expect(safeFileUrl('https://images.example.com/image/a.png')).toBe(
      'https://images.example.com/image/a.png'
    );
    expect(safeFileUrl('/image/a.png')).toBe('/image/a.png');
  });

  it.each([
    '//evil.example/a.png',
    'javascript:alert(1)',
    'https://evil.example/a.png',
    'http://images.example.com.evil.example/a.png',
    '/\\evil.example',
    'data:text/html,hi',
    '',
    null,
    42,
  ])('rejects url %s', (value) => {
    expect(safeFileUrl(value)).toBeNull();
  });

  it('keeps image-server urls in the shape the demo seed stores', () => {
    const old = process.env.IMAGE_APP_URL;
    process.env.IMAGE_APP_URL = 'http://localhost:31450';
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const image = `http://localhost:31450/image/demo-buurtfoto-1-${uuid}.png`;
    const doc = `http://localhost:31450/document/demo-rapport-1-${uuid}.pdf`;
    const imageQ = summarize(fileItem, [
      {
        id: 1,
        createdAt: '2026-01-01',
        submittedData: { q1: [{ name: 'a.png', url: image }] },
      },
    ]);
    const docQ = summarize(
      { questionType: 'documentUpload', fieldKey: 'q1', title: 'Doc' },
      [
        {
          id: 1,
          createdAt: '2026-01-01',
          submittedData: { q1: [{ name: 'r.pdf', url: doc }] },
        },
      ]
    );
    expect(imageQ.preview[0].url).toBe(image);
    expect(docQ.preview[0].url).toBe(doc);
    if (old === undefined) delete process.env.IMAGE_APP_URL;
    else process.env.IMAGE_APP_URL = old;
  });

  it('only allows relative paths when IMAGE_APP_URL is missing', () => {
    delete process.env.IMAGE_APP_URL;
    expect(safeFileUrl('https://images.example.com/a.png')).toBeNull();
    expect(safeFileUrl('/a.png')).toBe('/a.png');
    process.env.IMAGE_APP_URL = 'https://images.example.com';
  });

  it('counts answers and files and returns only name and url', () => {
    const q = summarize(fileItem, [
      {
        id: 1,
        createdAt: '2026-01-01',
        submittedData: {
          q1: [
            {
              name: ' a.png ',
              url: '/image/a.png',
              description: 'secret',
              id: 9,
            },
            { name: '', url: 'https://evil.example/x' },
          ],
        },
      },
      { id: 2, createdAt: '2026-01-02', submittedData: { q1: '[]' } },
    ]);
    expect(q.chart).toBe('files');
    expect(q.answeredCount).toBe(1);
    expect(q.fileCount).toBe(2);
    expect(q.preview).toEqual([
      { name: 'a.png', url: '/image/a.png' },
      { name: 'Bestand', url: null },
    ]);
  });

  it('caps the preview at 5 files from the newest submissions', () => {
    const subs = [];
    for (let i = 1; i <= 8; i++) {
      subs.push({
        id: i,
        createdAt: `2026-01-0${i}`,
        submittedData: { q1: [{ name: `f${i}a` }, { name: `f${i}b` }] },
      });
    }
    // shuffled input: the result must not depend on the order given
    const q = summarize(fileItem, subs.reverse());
    expect(q.fileCount).toBe(16);
    expect(q.preview.map((f) => f.name)).toEqual([
      'f8a',
      'f8b',
      'f7a',
      'f7b',
      'f6a',
    ]);
  });

  it('trims long names to 200 characters', () => {
    const q = summarize(fileItem, [
      { id: 1, submittedData: { q1: [{ name: 'x'.repeat(300) }] } },
    ]);
    expect(q.preview[0].name).toHaveLength(200);
  });

  it('details rows carry files with only name and url', () => {
    const result = buildQuestionDetails(fileItem, [
      {
        id: 1,
        createdAt: '2026-01-01',
        submittedData: { q1: [{ name: 'a.png', url: '/a.png', secret: 'x' }] },
      },
    ]);
    expect(result.rows[0].files).toEqual([{ name: 'a.png', url: '/a.png' }]);
    expect(result.rows[0].answer).toBe('a.png');
  });
});

describe('details readable', () => {
  const details = (it, ...values) =>
    buildQuestionDetails(
      it,
      values.map((value, i) => ({
        id: i + 1,
        createdAt: `2026-01-0${i + 1}`,
        submittedData: { q1: value },
      }))
    );

  it('matrix: row and column names', () => {
    const matrixItem = {
      questionType: 'matrix',
      fieldKey: 'q1',
      matrix: {
        rows: [
          { trigger: '1', text: 'Groen' },
          { trigger: '2', text: 'Verlichting' },
        ],
        columns: [
          { trigger: 'a', text: 'Goed' },
          { trigger: 'b', text: 'Matig' },
        ],
      },
    };
    const r = details(matrixItem, ['1_a', '2_b'], ['9_z'], []);
    expect(r.total).toBe(1);
    expect(r.rows[0].answer).toBe('Groen: Goed; Verlichting: Matig');
  });

  it('sort: numbered labels, unknown skipped', () => {
    const sortItem = {
      questionType: 'sort',
      fieldKey: 'q1',
      options: [
        { trigger: 's1', titles: [{ key: 'Parkeren' }] },
        { trigger: 's2', titles: [{ key: 'Groen' }] },
      ],
    };
    const r = details(
      sortItem,
      JSON.stringify(['Parkeren', 'Zzz', 'Groen']),
      '',
      '[bad'
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].answer).toBe('1. Parkeren, 2. Groen');
  });

  it('swipe: card and answer', () => {
    const swipeItem = {
      questionType: 'swipe',
      fieldKey: 'q1',
      options: [
        { trigger: 'c1', titles: [{ key: 'Fietspad' }] },
        { trigger: 'c2', titles: [{ key: 'Bankje' }] },
      ],
    };
    const r = details(swipeItem, [
      { cardId: 'c2', answer: 'skipped' },
      { cardId: 'c1', answer: 'Eens' },
      { cardId: 'nope', answer: 'Eens' },
    ]);
    expect(r.rows[0].answer).toBe('Fietspad: Eens; Bankje: Overgeslagen');
  });

  it("dilemma: chosen titles, '' left out", () => {
    const dilemmaItem = {
      questionType: 'dilemma',
      fieldKey: 'q1',
      options: [
        {
          trigger: 'd1',
          titles: [{ key: 'Meer groen', key_b: 'Meer parkeren' }],
        },
        { trigger: 'd2', titles: [{ key: 'Licht', key_b: 'Donker' }] },
      ],
    };
    const r = details(
      dilemmaItem,
      [
        { dilemmaId: 'd1', answer: 'a' },
        { dilemmaId: 'd2', answer: '' },
      ],
      [{ dilemmaId: 'd2', answer: '' }]
    );
    expect(r.total).toBe(1);
    expect(r.rows[0].answer).toBe('Meer groen');
  });
});

describe('bounded work', () => {
  // A getter that counts reads: a config lookup built per row would show up here.
  const counted = (base, key) => {
    const counter = { reads: 0 };
    const value = base[key];
    Object.defineProperty(base, key, {
      get() {
        counter.reads += 1;
        return value;
      },
    });
    return counter;
  };

  it('keeps previews at 5 and reads config once per question', () => {
    const matrixItem = {
      questionType: 'matrix',
      fieldKey: 'm',
      matrix: {
        rows: [{ trigger: '1', text: 'R' }],
        columns: [{ trigger: 'a', text: 'C' }],
      },
    };
    const sortItem = {
      questionType: 'sort',
      fieldKey: 's',
      options: [{ trigger: 'x', titles: [{ key: 'A' }] }],
    };
    const swipeItem = {
      questionType: 'swipe',
      fieldKey: 'w',
      options: [{ trigger: 'c1', titles: [{ key: 'K' }] }],
    };
    const fileItem = { questionType: 'imageUpload', fieldKey: 'f' };
    const reads = [
      counted(matrixItem, 'matrix'),
      counted(sortItem, 'options'),
      counted(swipeItem, 'options'),
    ];

    const subs = Array.from({ length: 2000 }, (_, i) => ({
      id: i,
      createdAt: new Date(2026, 0, 1, 0, 0, i),
      submittedData: {
        m: ['1_a'],
        s: JSON.stringify(['A']),
        w: [{ cardId: 'c1', answer: 'Eens' }],
        f: Array.from({ length: 10 }, (_, n) => ({ name: `f${i}-${n}` })),
      },
    }));
    const questions = buildQuestionSummaries(
      [matrixItem, sortItem, swipeItem, fileItem],
      subs
    );

    const files = questions.find((q) => q.chart === 'files');
    expect(files.preview).toHaveLength(5);
    expect(files.fileCount).toBe(20000);
    reads.forEach((counter) => expect(counter.reads).toBeLessThanOrEqual(2));

    // Details: one lookup per call, not per row.
    buildQuestionDetails(matrixItem, subs, { pageSize: 100 });
    expect(reads[0].reads).toBeLessThanOrEqual(4);
  });
});

describe('map points', () => {
  const mapItem = { questionType: 'map', fieldKey: 'q1', title: 'Waar?' };

  it('counts object and JSON-string pins, skips empty and invalid ones', () => {
    const q = summarize(mapItem, [
      { submittedData: { q1: { lat: 52.1, lng: 5.1 } } },
      { submittedData: { q1: '{"lat":52.2,"lng":5.2}' } },
      { submittedData: { q1: {} } },
      { submittedData: { q1: '{}' } },
      { submittedData: { q1: 'not json' } },
      { submittedData: { q1: { lat: 'x', lng: 5 } } },
      { submittedData: { q1: { lat: 95, lng: 5 } } },
      { submittedData: { q1: { lat: 52, lng: 190 } } },
      { submittedData: {} },
    ]);
    expect(q.chart).toBe('map');
    expect(q.answeredCount).toBe(2);
  });

  it('parseMapPoint returns null for out of range and garbage', () => {
    expect(parseMapPoint({ lat: -91, lng: 0 })).toBeNull();
    expect(parseMapPoint({ lat: 0, lng: 181 })).toBeNull();
    expect(parseMapPoint({ lat: NaN, lng: 0 })).toBeNull();
    expect(parseMapPoint(null)).toBeNull();
    expect(parseMapPoint([1, 2])).toBeNull();
    expect(parseMapPoint({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 });
  });

  it('gives the same count in the details as on the card', () => {
    const subs = [
      { id: '1', submittedData: { q1: { lat: 52.1, lng: 5.1 } } },
      { id: '2', submittedData: { q1: { lat: 99, lng: 5.1 } } },
      { id: '3', submittedData: { q1: '{}' } },
      { id: '4', submittedData: { q1: '{"lat":1,"lng":2}' } },
    ];
    const card = summarize(mapItem, subs);
    const details = buildQuestionDetails(mapItem, subs, {});
    expect(details.total).toBe(card.answeredCount);
    expect(details.total).toBe(2);
  });
});

describe('performance', () => {
  it('summarises 10,000 submissions within the time budget', () => {
    const items = [
      item(),
      {
        questionType: 'multiple',
        fieldKey: 'q2',
        title: 'M',
        options: item().options,
      },
      { questionType: 'open', fieldKey: 'q3', title: 'O' },
      { questionType: 'scale', fieldKey: 'q4', title: 'S' },
      { questionType: 'map', fieldKey: 'q5', title: 'M' },
    ];
    const subs = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      createdAt: new Date(2026, 9, 1 + (i % 28)),
      submittedData: {
        q1: i % 2 ? 'Ja' : 'Nee',
        q2: arr('Ja', 'Nee'),
        q3: `antwoord ${i}`,
        q4: String((i % 5) + 1),
        q5: { lat: 52 + (i % 100) / 1000, lng: 5 + (i % 100) / 1000 },
      },
    }));
    const start = performance.now();
    const result = buildQuestionSummaries(items, subs);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toHaveLength(5);
  });
});

describe('every question type in the demo survey', () => {
  const choiceOptions = (labels) =>
    labels.map((key, i) => ({ trigger: `o${i}`, titles: [{ key }] }));
  const config = [
    {
      questionType: 'multiplechoice',
      fieldKey: 'a',
      title: 'A',
      options: choiceOptions(['x', 'y']),
    },
    {
      questionType: 'multiple',
      fieldKey: 'b',
      title: 'B',
      options: choiceOptions(['x', 'y']),
    },
    {
      questionType: 'images',
      fieldKey: 'c',
      title: 'C',
      options: choiceOptions(['x', 'y']),
    },
    {
      questionType: 'dropdown',
      fieldKey: 'd',
      title: 'D',
      options: choiceOptions(['x', 'y']),
    },
    { questionType: 'documentUpload', fieldKey: 'e', title: 'E' },
    { questionType: 'imageUpload', fieldKey: 'f', title: 'F' },
    { questionType: 'open', fieldKey: 'g', title: 'G' },
    { questionType: 'none', title: 'Info' },
    { questionType: 'video', title: 'Video' },
    { questionType: 'pagination', title: 'Pagina' },
  ];
  const submissions = [
    {
      submittedData: {
        a: 'x',
        b: JSON.stringify(['x']),
        c: 'x',
        d: 'y',
        e: [{ name: 'a.pdf', url: '/image/a.pdf' }],
      },
    },
  ];

  it('gives one summary per question type and none for info, video, pagination', () => {
    const result = buildQuestionSummaries(config, submissions);
    expect(result.map((q) => [q.fieldKey, q.type, q.chart])).toEqual([
      ['a', 'multiplechoice', 'donut'],
      ['b', 'multiple', 'bar'],
      ['c', 'images', 'donut'],
      ['d', 'dropdown', 'donut'],
      ['e', 'documentUpload', 'files'],
      ['f', 'imageUpload', 'files'],
      ['g', 'open', 'open'],
    ]);
  });

  it('counts the dropdown and image answers', () => {
    const result = buildQuestionSummaries(config, submissions);
    const dropdown = result.find((q) => q.fieldKey === 'd');
    expect(dropdown.options.find((o) => o.label === 'y').count).toBe(1);
    const images = result.find((q) => q.fieldKey === 'c');
    expect(images.options.find((o) => o.label === 'x').count).toBe(1);
  });
});
