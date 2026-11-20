import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';
process.env.PDF_API_ENDPOINT = 'https://pdf.example/api';
process.env.PDF_API_KEY = 'k';

const require = createRequire(import.meta.url);
const db = require('../../db');
const pdfService = require('../../services/pdf-service');

let pdfCalls = 0;
pdfService.generatePdf = async () => {
  pdfCalls += 1;
  return Buffer.from('%PDF-fake');
};

db.Widget.findOne = async (query) =>
  query.where.projectId === '1' ? { config: { items: [] } } : null;
db.Submission.findAll = async () => [];

const {
  mountEnquetePdfBodyParser,
} = require('../../middleware/enquete-pdf-body-parser');
const scopeGuard = require('../../middleware/api-token-scope-guard');
const statsRouter = require('./index');

// Same order as Server.js: scope guard, the PDF parser, the global parser, routes.
function createApp() {
  const app = express();
  app.use((req, res, next) => {
    const role = req.get('x-test-role');
    req.user = role ? { role, id: 1 } : undefined;
    if (req.get('x-test-token') === 'reports') req.apiTokenScope = 'reports';
    req.project = { id: 1, config: {} };
    next();
  });
  app.use(scopeGuard);
  mountEnquetePdfBodyParser(app);
  app.use(express.json({ limit: '10mb' }));
  app.use('/stats', statsRouter);
  app.use((err, req, res, next) => {
    res
      .status(err.status || err.statusCode || 500)
      .json({ error: err.message });
  });
  return app;
}

const pdfUrl = '/stats/project/1/enquete/7/pdf';

describe('enquete pdf route through the real chain', () => {
  beforeEach(() => {
    pdfCalls = 0;
  });

  it('returns 200 for an editor', async () => {
    const res = await request(createApp())
      .post(pdfUrl)
      .set('x-test-role', 'editor')
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(200);
    expect(pdfCalls).toBe(1);
  });

  it('returns 401 without a user and for a member', async () => {
    const anon = await request(createApp())
      .post(pdfUrl)
      .send({ html: '<p>x</p>' });
    expect(anon.status).toBe(401);
    const member = await request(createApp())
      .post(pdfUrl)
      .set('x-test-role', 'member')
      .send({ html: '<p>x</p>' });
    expect(member.status).toBe(401);
    expect(pdfCalls).toBe(0);
  });

  it('returns 403 for a reporting token', async () => {
    const res = await request(createApp())
      .post(pdfUrl)
      .set('x-test-role', 'editor')
      .set('x-test-token', 'reports')
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(403);
    expect(pdfCalls).toBe(0);
  });

  it("returns 404 for another project's widget", async () => {
    const res = await request(createApp())
      .post('/stats/project/2/enquete/7/pdf')
      .set('x-test-role', 'editor')
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(404);
  });

  it('returns 413 above 2 MB, counted in bytes not characters', async () => {
    // "é" is 2 bytes in UTF-8: 1.2M characters are about 2.4 MB.
    const html = `<p>${'é'.repeat(1_200_000)}</p>`;
    expect(html.length).toBeLessThan(2 * 1024 * 1024);
    const res = await request(createApp())
      .post(pdfUrl)
      .set('x-test-role', 'editor')
      .send({ html });
    expect(res.status).toBe(413);
    expect(pdfCalls).toBe(0);
  });

  it('keeps the 10 MB limit for other routes', async () => {
    const big = 'a'.repeat(3 * 1024 * 1024);
    const res = await request(createApp())
      .post('/stats/project/1/vote')
      .set('x-test-role', 'editor')
      .send({ filler: big });
    expect(res.status).not.toBe(413);
  });
});
