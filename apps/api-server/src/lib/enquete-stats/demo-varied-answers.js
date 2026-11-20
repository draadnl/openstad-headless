// Demo seed helper: deterministic answers with varied distributions.
const { makeRandom } = require('./demo-sort-answers');

const MATRIX_WEIGHTS = [
  [0.65, 0.25, 0.1], // Groen
  [0.2, 0.55, 0.25], // Verlichting
  [0.2, 0.3, 0.5], // Speelplekken
];

const SWIPE_ANSWERS = ['Eens', 'Oneens', 'skipped'];
const SWIPE_WEIGHTS = [
  [0.72, 0.2, 0.08], // Fietspad
  [0.48, 0.37, 0.15], // Extra bankjes
  [0.24, 0.66, 0.1], // Autovrije straat
];

const DILEMMA_ANSWERS = ['a', 'b', 'skipped'];
const DILEMMA_WEIGHTS = [
  [0.68, 0.24, 0.08],
  [0.38, 0.47, 0.15],
];

const SCALE_WEIGHTS = [0.06, 0.16, 0.36, 0.3, 0.12];

// Own seed base per question, so the questions do not follow each other.
const SEEDS = {
  scale: 6001,
  matrix: 7001,
  swipe: 9001,
  dilemma: 10001,
  images: 12001,
  dropdown: 13001,
};

// Image options and dropdown options of the demo survey, with their weights.
const IMAGE_LABELS = ['Het park', 'Het plein', 'De speeltuin'];
const IMAGE_WEIGHTS = [0.5, 0.3, 0.2];
const DROPDOWN_LABELS = ['Centrum', 'Noord', 'Oost', 'West'];
const DROPDOWN_WEIGHTS = [0.35, 0.25, 0.25, 0.15];

function seededRandom(base, index) {
  const random = makeRandom(base + index * 7919);
  random();
  random();
  return random;
}

function pickWeighted(random, weights) {
  const value = random();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (value < sum) return i;
  }
  return weights.length - 1;
}

function demoScaleAnswer(index) {
  const random = seededRandom(SEEDS.scale, index);
  return String(pickWeighted(random, SCALE_WEIGHTS) + 1);
}

function demoMatrixAnswer(index) {
  const random = seededRandom(SEEDS.matrix, index);
  return MATRIX_WEIGHTS.map(
    (weights, row) => `r${row}_c${pickWeighted(random, weights)}`
  );
}

function demoSwipeAnswers(index) {
  const random = seededRandom(SEEDS.swipe, index);
  return SWIPE_WEIGHTS.map((weights, card) => ({
    cardId: `card-${card}`,
    answer: SWIPE_ANSWERS[pickWeighted(random, weights)],
  }));
}

function demoDilemmaAnswers(index) {
  const random = seededRandom(SEEDS.dilemma, index);
  return DILEMMA_WEIGHTS.map((weights, dilemma) => ({
    dilemmaId: `dilemma-${dilemma}`,
    answer: DILEMMA_ANSWERS[pickWeighted(random, weights)],
  }));
}

function demoImageChoice(index) {
  const random = seededRandom(SEEDS.images, index);
  return IMAGE_LABELS[pickWeighted(random, IMAGE_WEIGHTS)];
}

function demoDropdownAnswer(index) {
  const random = seededRandom(SEEDS.dropdown, index);
  return DROPDOWN_LABELS[pickWeighted(random, DROPDOWN_WEIGHTS)];
}

// Every 5th person uploads one or two documents; the others skip the question.
function demoDocuments(index, documentUrls) {
  if (index % 5 !== 0 || !documentUrls || documentUrls.length === 0) {
    return undefined;
  }
  const count = index % 10 === 0 ? 2 : 1;
  return Array.from({ length: count }, (_, n) => {
    const file = (index / 5 + n) % documentUrls.length;
    return { name: `rapport-${file + 1}.pdf`, url: documentUrls[file] };
  });
}

// Every 4th person uploads one photo, taken from the uploaded demo photos in turn.
function demoPhotoUploads(index, photoUrls) {
  if (index % 4 !== 0 || !photoUrls || photoUrls.length === 0) {
    return undefined;
  }
  const photo = (index / 4) % photoUrls.length;
  return [{ name: `buurtfoto-${photo + 1}.png`, url: photoUrls[photo] }];
}

// Deep equal that ignores object key order (MySQL JSON columns reorder keys).
function sameJson(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) && sameJson(a[key], b[key])
    )
  );
}

module.exports = {
  sameJson,
  demoImageChoice,
  demoDropdownAnswer,
  demoDocuments,
  demoPhotoUploads,
  IMAGE_LABELS,
  DROPDOWN_LABELS,
  demoScaleAnswer,
  demoMatrixAnswer,
  demoSwipeAnswers,
  demoDilemmaAnswers,
  MATRIX_WEIGHTS,
  SWIPE_WEIGHTS,
  DILEMMA_WEIGHTS,
  SCALE_WEIGHTS,
};
