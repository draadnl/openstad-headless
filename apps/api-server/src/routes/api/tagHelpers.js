const sanitize = require('../../util/sanitize');

// Helpers for tag creation, extracted so the seqnr-assignment rule
// can be unit tested without a database.

// Mirrors the `type` setter of the Tag model (models/Tag.js), so a lookup
// by type matches the value that will actually be stored. Without this a
// request for ' theme ' or 'thème' would query a type that does not exist
// while the model stores 'theme'.
function normalizeTagType(type) {
  if (!type) return null;
  // The setter stores null for any falsy value, so a type that sanitizes down
  // to an empty string must become null here too - otherwise the lookup below
  // would query '' while the row is stored as null.
  return sanitize.safeTags(String(type).trim()) || null;
}

// A sequence number counts as provided only when it is a finite number, or a
// string that represents one. Everything else (undefined, null, '', '   ',
// booleans, arrays, 'abc', Infinity) means "not provided" and triggers
// automatic bottom placement.
function isSeqnrProvided(seqnr) {
  if (typeof seqnr === 'number') return Number.isFinite(seqnr);
  if (typeof seqnr !== 'string') return false;
  if (seqnr.trim() === '') return false;
  return Number.isFinite(Number(seqnr));
}

// When no seqnr is provided, the new tag should be placed at the
// bottom of its type group: one step past the current highest seqnr
// in that group (or 10 when the group is empty).
function resolveSeqnr(providedSeqnr, maxSeqnrInGroup) {
  if (isSeqnrProvided(providedSeqnr)) {
    return providedSeqnr;
  }

  return (Number.isFinite(maxSeqnrInGroup) ? maxSeqnrInGroup : 0) + 10;
}

module.exports = {
  normalizeTagType,
  isSeqnrProvided,
  resolveSeqnr,
};
