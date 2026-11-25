const sanitize = require('./sanitize');

const ENTITIES = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;|&#x27;/g, "'"],
  [/&amp;/g, '&'],
];

function plainTitle(text) {
  let value = sanitize.title(String(text || '').trim());
  for (const [pattern, char] of ENTITIES) value = value.replace(pattern, char);
  return value.trim();
}

module.exports = { plainTitle };
