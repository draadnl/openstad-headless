const express = require('express');
const createError = require('http-errors');
const { Op, fn, col, literal, where } = require('sequelize');
const rateLimiter = require('@openstad-headless/lib/rateLimiter');
const db = require('../../db');
const hasRole = require('../../lib/sequelize-authorization/lib/hasRole');
const {
  buildQuestionSummaries,
  buildQuestionDetails,
  isPersonalDataItem,
  parseMapPoint,
} = require('../../lib/enquete-stats/aggregate-enquete');
const { generatePdf, isPdfConfigured } = require('../../services/pdf-service');
const { buildPdfDocument } = require('./enquete-pdf-document');

const router = express.Router({ mergeParams: true });

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Accept only real calendar days, so "2026-02-30" is refused.
function parseDay(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  return date;
}

// Builds the createdAt filter. "to" is inclusive: we stop before the next day.
function buildDateWhere(query) {
  const from = parseDay(query.from);
  const to = parseDay(query.to);
  if (from === false || to === false) {
    throw createError(400, 'Invalid date, use YYYY-MM-DD');
  }
  if (from && to && from > to) {
    throw createError(400, '"from" must not be after "to"');
  }

  const range = {};
  if (from) range[Op.gte] = from;
  if (to) range[Op.lt] = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  return Reflect.ownKeys(range).length ? { createdAt: range } : {};
}

const MAX_MAP_POINTS = 2000;
const SAFE_FIELD_KEY = /^[A-Za-z0-9_-]+$/;

// Loads at most 2,000 pins for one map question straight from the database.
async function loadMapPoints(req, dateWhere, fieldKey) {
  // Only plain keys go into the SQL path: no injection through widget config.
  if (typeof fieldKey !== 'string' || !SAFE_FIELD_KEY.test(fieldKey)) {
    return { points: [], pointsTruncated: false };
  }
  const extract = fn(
    'JSON_EXTRACT',
    col('submittedData'),
    literal(`'$."${fieldKey}"'`)
  );
  const rows = await db.Submission.findAll({
    where: {
      projectId: req.params.projectId,
      widgetId: req.params.widgetId,
      ...dateWhere,
      [Op.and]: [where(extract, { [Op.ne]: null })],
    },
    attributes: [[extract, 'point']],
    limit: MAX_MAP_POINTS + 1,
    raw: true,
  });

  const points = [];
  for (const row of rows) {
    const point = parseMapPoint(row.point);
    if (point) points.push(point);
  }
  points.sort((a, b) => a.lat - b.lat || a.lng - b.lng);

  const round = (value) => Math.round(value * 1e5) / 1e5;
  return {
    points: points
      .slice(0, MAX_MAP_POINTS)
      .map((p) => ({ lat: round(p.lat), lng: round(p.lng) })),
    pointsTruncated: points.length > MAX_MAP_POINTS,
  };
}

// Ids of the survey's own allowed areas, numbers only.
function allowedAreaIds(config) {
  const polygons = Array.isArray(config.allowedPolygons)
    ? config.allowedPolygons
    : [];
  return polygons
    .map((polygon) => Number(polygon && polygon.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function guard(req, res, next) {
  if (!(req.user && hasRole(req.user, 'editor'))) {
    return next(createError(401, 'Je kunt deze statistieken niet bekijken'));
  }
  // Reporting tokens never get survey answers.
  if (req.reportingScope) {
    return next(createError(403, 'Not available for reporting tokens'));
  }
  next();
}

async function loadWidget(req, res, next) {
  try {
    const widget = await db.Widget.findOne({
      where: {
        id: req.params.widgetId,
        projectId: req.params.projectId,
        type: 'enquete',
      },
    });
    if (!widget) return next(createError(404, 'Widget not found'));
    req.enqueteWidget = widget;
    next();
  } catch (err) {
    next(err);
  }
}

function loadSubmissions(req, dateWhere) {
  return db.Submission.findAll({
    where: {
      projectId: req.params.projectId,
      widgetId: req.params.widgetId,
      ...dateWhere,
    },
    attributes: ['id', 'createdAt', 'submittedData'],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    raw: true,
  });
}

router
  .route('/:widgetId(\\d+)')
  .get(rateLimiter(), guard, loadWidget, async (req, res, next) => {
    try {
      const dateWhere = buildDateWhere(req.query);
      const submissions = await loadSubmissions(req, dateWhere);

      const config = req.enqueteWidget.config || {};
      const items = Array.isArray(config.items) ? config.items : [];

      const questions = buildQuestionSummaries(items, submissions);
      const areaIds = allowedAreaIds(config);
      for (const question of questions) {
        if (question.chart !== 'map') continue;
        Object.assign(
          question,
          await loadMapPoints(req, dateWhere, question.fieldKey),
          { areaIds }
        );
      }

      res.json({
        total: submissions.length,
        pdfEnabled: isPdfConfigured(),
        questions,
      });
    } catch (err) {
      next(err);
    }
  });

router
  .route('/:widgetId(\\d+)/details')
  .get(rateLimiter(), guard, loadWidget, async (req, res, next) => {
    try {
      const dateWhere = buildDateWhere(req.query);

      const fieldKey = req.query.fieldKey;
      const config = req.enqueteWidget.config || {};
      const items = Array.isArray(config.items) ? config.items : [];
      const item =
        typeof fieldKey === 'string' && fieldKey !== ''
          ? items.find(
              (candidate) => candidate && candidate.fieldKey === fieldKey
            )
          : null;
      if (!item || !item.questionType) {
        return next(createError(400, 'Unknown fieldKey for this widget'));
      }
      if (isPersonalDataItem(item)) {
        return next(
          createError(403, 'Answers to this question contain personal data')
        );
      }

      for (const name of ['page', 'pageSize']) {
        const value = req.query[name];
        if (value !== undefined && !/^\d+$/.test(String(value))) {
          return next(createError(400, `${name} must be a number`));
        }
      }

      if (
        req.query.order !== undefined &&
        !['asc', 'desc'].includes(req.query.order)
      ) {
        return next(createError(400, 'order must be asc or desc'));
      }

      const submissions = await loadSubmissions(req, dateWhere);
      res.json(
        buildQuestionDetails(item, submissions, {
          page: req.query.page,
          pageSize: req.query.pageSize,
          order: req.query.order,
        })
      );
    } catch (err) {
      next(err);
    }
  });

// Makes a safe file name: only a-z, 0-9 and "-", at most 80 characters.
function safePdfFilename(value) {
  const base = String(typeof value === 'string' ? value : '')
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base ? `${base}.pdf` : 'enquete.pdf';
}

// PDF of statistics blocks: editors and up only; the HTML is sanitized, never stored or logged.
router
  .route('/:widgetId(\\d+)/pdf')
  .post(rateLimiter(), guard, loadWidget, async (req, res, next) => {
    try {
      const html = req.body && req.body.html;
      if (typeof html !== 'string' || html.trim() === '') {
        return next(createError(400, 'html is required'));
      }
      if (!isPdfConfigured()) {
        return next(createError(503, 'PDF generation is not configured'));
      }

      let pdf;
      try {
        pdf = await generatePdf(buildPdfDocument(html), { timeoutMs: 30000 });
      } catch (err) {
        // Status and fixed code only, never the upstream body.
        console.error(
          `[enquete-pdf] failed: ${err && err.code ? err.code : 'PDF_UPSTREAM_ERROR'}${err && err.status ? ` (${err.status})` : ''}`
        );
        return next(createError(502, 'PDF generation failed'));
      }

      const filename = safePdfFilename(req.body.filename);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length,
        'Cache-Control': 'private, no-store',
      });
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
