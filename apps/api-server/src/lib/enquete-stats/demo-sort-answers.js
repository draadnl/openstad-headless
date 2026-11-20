// Demo seed helper: a deterministic sort order per submission.

// Preferred place per option (lower = better).
const BASE_SCORES = [2.3, 1.7, 2.7, 3.3];

function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function demoSortOrder(index, labels) {
  const random = makeRandom(1722 + index * 7919);
  random();
  random();
  return labels
    .map((label, position) => ({
      label,
      score: (BASE_SCORES[position] ?? position + 1) + (random() - 0.5) * 1.6,
    }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.label);
}

module.exports = { demoSortOrder, makeRandom };
