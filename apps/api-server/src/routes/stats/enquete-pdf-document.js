const {
  sanitizePdfHtml,
} = require('../../lib/enquete-stats/sanitize-pdf-html');

const { PDF_CSS } = require('./enquete-pdf-styles');

// Wraps the cleaned block HTML in a full page with our own stylesheet.
function buildPdfDocument(html) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<style>${PDF_CSS}</style>
</head>
<body>${sanitizePdfHtml(html)}</body>
</html>`;
}

module.exports = { buildPdfDocument };
