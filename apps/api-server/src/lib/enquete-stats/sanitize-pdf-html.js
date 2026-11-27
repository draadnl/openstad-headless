const sanitizeHtml = require('sanitize-html');

// The browser sends chart HTML; it is untrusted and sanitized here.

const DROPPED_WITH_CONTENT = [
  'defs',
  'clipPath',
  'title',
  'desc',
  'mask',
  'pattern',
  'linearGradient',
  'radialGradient',
];

const ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'li',
  'strong',
  'br',
  'img',
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'table',
  'caption',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  // Allowed only so the exclusiveFilter below can drop them WITH their content.
  ...DROPPED_WITH_CONTENT,
];

const SVG_ATTRIBUTES = [
  'viewBox',
  'width',
  'height',
  'd',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-linejoin',
  'fill-rule',
  'fill-opacity',
  'opacity',
  'transform',
  'text-anchor',
  'dominant-baseline',
  'font-size',
];

const ALLOWED_ATTRIBUTES = {
  '*': [
    'class',
    'style',
    'role',
    'aria-label',
    'aria-hidden',
    ...SVG_ATTRIBUTES,
  ],
  img: ['src', 'alt', 'width', 'height', 'class', 'style'],
  th: ['scope'],
};

// Only plain characters in a style value. No quotes, no backslash, no "@".
const SAFE_VALUE_CHARS = /^[a-zA-Z0-9\s.,#%()+\-/!]*$/;
// Words that can load things or run code, even without a "url(" in front.
const BLOCKED_VALUE_WORDS =
  /url|expression|image-set|image\(|element\(|attr\(|var\(|calc\(|behavior|binding|javascript/i;

function isSafeStyleValue(value) {
  return SAFE_VALUE_CHARS.test(value) && !BLOCKED_VALUE_WORDS.test(value);
}

// One shared check for every allowed CSS property.
const safeValue = [{ test: (value) => isSafeStyleValue(String(value)) }];

const ALLOWED_STYLE_PROPERTIES = [
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'top',
  'left',
  'right',
  'bottom',
  'position',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'color',
  'background-color',
  'opacity',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'display',
  'flex',
  'flex-direction',
  'align-items',
  'justify-content',
  'gap',
  'border',
  'border-radius',
  'border-color',
  'border-width',
  'border-style',
  'z-index',
  'transform',
  'fill',
  'stroke',
  'stroke-width',
];

const ALLOWED_STYLES = {
  '*': {
    ...Object.fromEntries(
      ALLOWED_STYLE_PROPERTIES.map((property) => [property, safeValue])
    ),
    // No "fixed": it could cover the whole PDF page.
    position: [/^(relative|absolute)$/],
  },
};

// Leaflet adds its own classes; ours all start with "pdf-".
const ALLOWED_CLASSES = { '*': [/^pdf-[a-z0-9-]+$/, /^leaflet-[a-z0-9-]+$/] };

const OSM_TILE =
  /^https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;
// The flattened survey map is sent as JPEG (tiles compress badly as PNG).
const DATA_IMAGE = /^data:image\/(png|jpeg|svg\+xml)[;,]/i;

function isAllowedImageSrc(src) {
  if (typeof src !== 'string') return false;
  return OSM_TILE.test(src) || DATA_IMAGE.test(src);
}

function sanitizePdfHtml(html) {
  return sanitizeHtml(typeof html === 'string' ? html : '', {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses: ALLOWED_CLASSES,
    allowedStyles: ALLOWED_STYLES,
    // Not used on purpose: we never allow href, srcset or xlink:href at all.
    allowedSchemes: [],
    allowedSchemesByTag: { img: ['data', 'https'] },
    allowProtocolRelative: false,
    // Case matters for SVG names like "viewBox".
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    // A tag that is not allowed is dropped but its text is kept (see exclusiveFilter).
    disallowedTagsMode: 'discard',
    // SVG paint attributes (fill, stroke, ...) can hold url(...) too, so they are checked.
    transformTags: {
      '*': (tagName, attribs) => {
        const next = {};
        for (const [name, value] of Object.entries(attribs)) {
          if (name === 'src' || name === 'style' || name === 'class') {
            next[name] = value;
          } else if (isSafeStyleValue(String(value))) {
            next[name] = value;
          }
        }
        return { tagName, attribs: next };
      },
    },
    exclusiveFilter: (frame) =>
      DROPPED_WITH_CONTENT.includes(frame.tag) ||
      (frame.tag === 'img' && !isAllowedImageSrc(frame.attribs.src)),
  });
}

module.exports = { sanitizePdfHtml, isAllowedImageSrc, isSafeStyleValue };
