import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';

const require = createRequire(import.meta.url);
const db = require('../../db');
const pdfService = require('../../services/pdf-service');

let sentHtml = null;
let sentOptions = null;
let pdfResult = Buffer.from('%PDF-1.4 fake');
pdfService.generatePdf = async (html, options) => {
  sentHtml = html;
  sentOptions = options;
  if (pdfResult instanceof Error) throw pdfResult;
  return pdfResult;
};

db.Widget.findOne = async () => ({ config: { items: [] } });
db.Submission.findAll = async () => [];

const enqueteRouter = require('./enquete');

function createApp(user) {
  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.use(express.json());
  app.use('/project/:projectId(\\d+)/enquete', enqueteRouter);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

const editor = { role: 'editor', id: 1 };
const url = '/project/1/enquete/7/pdf';

describe('POST enquete pdf', () => {
  beforeEach(() => {
    sentHtml = null;
    pdfResult = Buffer.from('%PDF-1.4 fake');
    process.env.PDF_API_ENDPOINT = 'https://pdf.example/api';
    process.env.PDF_API_KEY = 'k';
  });
  afterEach(() => {
    delete process.env.PDF_API_ENDPOINT;
    delete process.env.PDF_API_KEY;
  });

  it('returns a pdf with a safe file name', async () => {
    const res = await request(createApp(editor)).post(url).send({
      html: '<div class="pdf-card">x</div>',
      filename: '../Ev il/../name.pdf',
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="ev-il-name.pdf"'
    );
    expect(sentHtml).toContain('<div class="pdf-card">x</div>');
  });

  it('falls back to enquete.pdf when there is no usable name', async () => {
    const res = await request(createApp(editor))
      .post(url)
      .send({ html: '<p>x</p>', filename: '***' });
    expect(res.headers['content-disposition']).toContain(
      'filename="enquete.pdf"'
    );
  });

  it('answers 400 without html', async () => {
    const res = await request(createApp(editor)).post(url).send({});
    expect(res.status).toBe(400);
  });

  it('answers 503 when the PDF service is not configured', async () => {
    delete process.env.PDF_API_KEY;
    const res = await request(createApp(editor))
      .post(url)
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(503);
  });

  it('answers 502 when the PDF service fails', async () => {
    pdfResult = Object.assign(new Error('PDF_UPSTREAM_ERROR'), {
      code: 'PDF_UPSTREAM_ERROR',
    });
    const res = await request(createApp(editor))
      .post(url)
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(502);
  });

  it('refuses users below editor', async () => {
    const res = await request(createApp({ role: 'member', id: 2 }))
      .post(url)
      .send({ html: '<p>x</p>' });
    expect(res.status).toBe(401);
  });

  it('keeps the key, the answers and the upstream text out of responses and logs', async () => {
    process.env.PDF_API_KEY = 'key-sentinel';
    pdfResult = Object.assign(
      new Error('upstream echoed key-sentinel and answer-sentinel'),
      { code: 'PDF_UPSTREAM_ERROR', status: 500 }
    );
    const logged = [];
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((name) => {
      const original = console[name];
      console[name] = (...args) => logged.push(args.map(String).join(' '));
      return () => (console[name] = original);
    });
    let res;
    try {
      res = await request(createApp(editor))
        .post(url)
        .send({ html: '<p>answer-sentinel</p>' });
    } finally {
      spies.forEach((restore) => restore());
    }
    expect(res.status).toBe(502);
    expect(JSON.stringify([res.body, res.text])).not.toMatch(/sentinel/);
    expect(logged.join('\n')).not.toMatch(/sentinel/);
    expect(logged.join('\n')).toContain('PDF_UPSTREAM_ERROR');
  });

  it('gives the PDF service a 30 second time limit', async () => {
    await request(createApp(editor)).post(url).send({ html: '<p>x</p>' });
    expect(sentOptions).toEqual({ timeoutMs: 30000 });
  });
});
