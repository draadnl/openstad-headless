import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  demoScaleAnswer,
  demoMatrixAnswer,
  demoSwipeAnswers,
  demoDilemmaAnswers,
  sameJson,
  demoImageChoice,
  demoDropdownAnswer,
  demoDocuments,
  demoPhotoUploads,
  IMAGE_LABELS,
  DROPDOWN_LABELS,
} = require('./demo-varied-answers');
const { buildQuestionSummaries } = require('./aggregate-enquete');

const COUNT = 192;
const range = Array.from({ length: COUNT }, (_, i) => i);

const tally = (values, size) => {
  const counts = Array(size).fill(0);
  values.forEach((v) => (counts[v] += 1));
  return counts;
};
const topIndex = (counts) => counts.indexOf(Math.max(...counts));

describe('demo varied answers', () => {
  it('returns the same answers for the same submission', () => {
    for (let i = 0; i < 20; i++) {
      expect(demoScaleAnswer(i)).toEqual(demoScaleAnswer(i));
      expect(demoMatrixAnswer(i)).toEqual(demoMatrixAnswer(i));
      expect(demoSwipeAnswers(i)).toEqual(demoSwipeAnswers(i));
      expect(demoDilemmaAnswers(i)).toEqual(demoDilemmaAnswers(i));
    }
  });

  it('uses valid answer formats', () => {
    for (const i of range) {
      expect(['1', '2', '3', '4', '5']).toContain(demoScaleAnswer(i));
      const matrix = demoMatrixAnswer(i);
      expect(matrix).toHaveLength(3);
      matrix.forEach((cell, r) =>
        expect(cell).toMatch(new RegExp(`^r${r}_c[0-2]$`))
      );
      demoSwipeAnswers(i).forEach((entry, c) => {
        expect(entry.cardId).toBe(`card-${c}`);
        expect(['Eens', 'Oneens', 'skipped']).toContain(entry.answer);
      });
      demoDilemmaAnswers(i).forEach((entry, d) => {
        expect(entry.dilemmaId).toBe(`dilemma-${d}`);
        expect(['a', 'b', 'skipped']).toContain(entry.answer);
      });
    }
  });

  it('gives each matrix row its own dominant column', () => {
    const perRow = (r) =>
      tally(
        range.map((i) => Number(demoMatrixAnswer(i)[r].split('_c')[1])),
        3
      );
    expect(topIndex(perRow(0))).toBe(0); // Groen: Goed
    expect(topIndex(perRow(1))).toBe(1); // Verlichting: Matig
  });

  it('gives each swipe card its own dominant answer', () => {
    const perCard = (c) =>
      tally(
        range.map((i) =>
          ['Eens', 'Oneens', 'skipped'].indexOf(demoSwipeAnswers(i)[c].answer)
        ),
        3
      );
    expect(topIndex(perCard(0))).toBe(0); // Fietspad: Eens
    expect(topIndex(perCard(2))).toBe(1); // Autovrije straat: Oneens
  });

  it('makes the two dilemmas differ clearly in answer a', () => {
    const shareA = (d) =>
      range.filter((i) => demoDilemmaAnswers(i)[d].answer === 'a').length /
      COUNT;
    expect(Math.abs(shareA(0) - shareA(1))).toBeGreaterThanOrEqual(0.15);
  });

  it('gives the scale a bell shape', () => {
    const counts = tally(
      range.map((i) => Number(demoScaleAnswer(i)) - 1),
      5
    );
    expect([2, 3]).toContain(topIndex(counts));
    expect(counts[0]).toBeLessThan(counts[2]);
  });

  it('shows different splits per row through the real aggregation', () => {
    const items = [
      {
        fieldKey: 'q6',
        questionType: 'scale',
        scaleDisplay: 'numbers',
        scaleStepCount: 5,
        title: 'Scale',
      },
      {
        fieldKey: 'q7',
        questionType: 'matrix',
        title: 'Matrix',
        matrix: {
          rows: ['Groen', 'Verlichting', 'Speelplekken'].map((text, i) => ({
            trigger: `r${i}`,
            text,
          })),
          columns: ['Goed', 'Matig', 'Slecht'].map((text, i) => ({
            trigger: `c${i}`,
            text,
          })),
        },
      },
      {
        fieldKey: 'q9',
        questionType: 'swipe',
        title: 'Swipe',
        options: ['Fietspad', 'Extra bankjes', 'Autovrije straat'].map(
          (key, i) => ({ trigger: `card-${i}`, titles: [{ key }] })
        ),
      },
      {
        fieldKey: 'q10',
        questionType: 'dilemma',
        title: 'Dilemma',
        options: [
          ['Meer groen', 'Meer parkeerplekken'],
          ['Minder verkeer', 'Snellere doorstroming'],
        ].map(([key, key_b], i) => ({
          trigger: `dilemma-${i}`,
          titles: [{ key, key_b }],
        })),
      },
    ];
    const submissions = range.map((i) => ({
      submittedData: {
        q6: demoScaleAnswer(i),
        q7: demoMatrixAnswer(i),
        q9: demoSwipeAnswers(i),
        q10: demoDilemmaAnswers(i),
      },
    }));
    const [scale, matrix, swipe, dilemma] = buildQuestionSummaries(
      items,
      submissions
    );
    const signatures = (question) =>
      question.rows.map((row) =>
        row.segments.map((segment) => segment.percentage).join('/')
      );

    expect(matrix.answeredCount).toBe(COUNT);
    expect(swipe.answeredCount).toBe(COUNT);
    expect(dilemma.answeredCount).toBe(COUNT);
    for (const question of [matrix, swipe, dilemma]) {
      expect(new Set(signatures(question)).size).toBeGreaterThan(1);
    }
    expect(scale.answeredCount).toBe(COUNT);
  });
});

describe('sameJson', () => {
  it('ignores the key order of objects', () => {
    expect(
      sameJson({ a: 1, b: [{ x: 1, y: 2 }] }, { b: [{ y: 2, x: 1 }], a: 1 })
    ).toBe(true);
  });

  it('is false for a different value or a missing key', () => {
    expect(sameJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameJson({ a: undefined }, { b: undefined })).toBe(false);
  });

  it('keeps the order of arrays', () => {
    expect(sameJson([1, 2], [2, 1])).toBe(false);
    expect(sameJson([1, 2], [1, 2])).toBe(true);
  });

  it('does not mix up arrays, objects and null', () => {
    expect(sameJson([], {})).toBe(false);
    expect(sameJson(null, {})).toBe(false);
    expect(sameJson(null, null)).toBe(true);
  });
});

describe('image, dropdown and document demo answers', () => {
  it('are deterministic and always one of the option labels', () => {
    for (const i of range) {
      expect(IMAGE_LABELS).toContain(demoImageChoice(i));
      expect(DROPDOWN_LABELS).toContain(demoDropdownAnswer(i));
      expect(demoImageChoice(i)).toBe(demoImageChoice(i));
      expect(demoDropdownAnswer(i)).toBe(demoDropdownAnswer(i));
    }
  });

  it('use every option and favour the first one', () => {
    const count = (fn, labels) =>
      labels.map((label) => range.filter((i) => fn(i) === label).length);
    const images = count(demoImageChoice, IMAGE_LABELS);
    const dropdown = count(demoDropdownAnswer, DROPDOWN_LABELS);
    expect(images.every((n) => n > 0)).toBe(true);
    expect(dropdown.every((n) => n > 0)).toBe(true);
    expect(images[0]).toBeGreaterThan(images[2]);
  });

  it('gives documents to every 5th person, with name and uploaded url', () => {
    const urls = [
      'https://img.example.com/d1.pdf',
      'https://img.example.com/d2.pdf',
    ];
    expect(demoDocuments(1, urls)).toBeUndefined();
    expect(demoDocuments(5, urls)).toHaveLength(1);
    expect(demoDocuments(10, urls)).toHaveLength(2);
    expect(demoDocuments(0, urls)[0]).toEqual({
      name: 'rapport-1.pdf',
      url: urls[0],
    });
    expect(demoDocuments(5, urls)[0]).toEqual({
      name: 'rapport-2.pdf',
      url: urls[1],
    });
    expect(range.filter((i) => demoDocuments(i, urls)).length).toBe(39);
  });
});

describe('demoPhotoUploads', () => {
  const photos = Array.from(
    { length: 6 },
    (_, n) => `https://img.example.com/p${n + 1}.png`
  );

  it('gives index 0 photo 1 and skips other indexes', () => {
    expect(demoPhotoUploads(0, photos)).toEqual([
      { name: 'buurtfoto-1.png', url: photos[0] },
    ]);
    expect(demoPhotoUploads(1, photos)).toBeUndefined();
  });

  it('cycles over the 6 photos on every 4th submission', () => {
    expect(demoPhotoUploads(24, photos)[0].url).toBe(photos[0]);
    expect(demoPhotoUploads(20, photos)[0].url).toBe(photos[5]);
    expect(range.filter((i) => demoPhotoUploads(i, photos)).length).toBe(48);
  });
});
