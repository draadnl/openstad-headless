const bodyParser = require('body-parser');

// The PDF route gets its own, smaller body limit than the global 10 MB.
const ENQUETE_PDF_PATH =
  '/stats/project/:projectId(\\d+)/enquete/:widgetId(\\d+)/pdf';
const ENQUETE_PDF_BODY_LIMIT = '2mb';

function mountEnquetePdfBodyParser(app) {
  app.post(
    ENQUETE_PDF_PATH,
    bodyParser.json({ limit: ENQUETE_PDF_BODY_LIMIT })
  );
}

module.exports = {
  mountEnquetePdfBodyParser,
  ENQUETE_PDF_PATH,
  ENQUETE_PDF_BODY_LIMIT,
};
