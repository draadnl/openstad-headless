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

process.env.IMAGE_APP_URL = 'https://images.example.com';

const require = createRequire(import.meta.url);
const db = require('../../db');
const enqueteRouter = require('./enquete');

const PROJECT_ID = 1;
const WIDGET_ID = 7;

let widgetWhere = null;
let submissionQuery = null;
let widgetExists = true;

db.Widget.findOne = async (query) => {
  widgetWhere = query.where;
  if (!widgetExists || query.where.projectId !== String(PROJECT_ID)) {
    return null;
  }
  return {
    config: {
      items: [
        {
          questionType: 'multiplechoice',
          fieldKey: 'q1',
          title: 'Tevreden?',
          options: [
            { trigger: 'a', titles: [{ key: 'Ja' }] },
            { trigger: 'b', titles: [{ key: 'Nee' }] },
          ],
        },
        { questionType: 'open', fieldKey: 'q2', title: 'Waarom?' },
        { questionType: 'imageUpload', fieldKey: 'up', title: 'Foto' },
        { questionType: 'map', fieldKey: 'loc', title: 'Waar?' },
        { questionType: 'map', fieldKey: 'x"); DROP', title: 'Evil' },
        {
          questionType: 'open',
          fieldKey: 'mail',
          variant: 'email',
          title: 'E-mail',
        },
      ],
      allowedPolygons: [{ id: 5, name: 'Gebied' }, { id: 'x' }, { id: -1 }],
    },
  };
};

let mapQuery = null;
let mapRows = [];

db.Submission.findAll = async (query) => {
  if (query.limit) {
    mapQuery = query;
    return mapRows;
  }
  submissionQuery = query;
  return [
    {
      id: 'secret-id',
      createdAt: new Date('2026-10-02T10:00:00Z'),
      ipAddress: '1.1.1.1',
      submittedData: {
        q1: 'Ja',
        q2: 'tweede',
        mail: 'geheim@example.org',
        embeddedUrl: 'http://x',
        up: [
          {
            name: 'a.png',
            url: 'https://images.example.com/image/a.png',
            description: 'private-note',
            ownerId: 'private-owner',
          },
          { name: 'b.png', url: 'javascript:alert(1)' },
        ],
      },
    },
    {
      id: 'id-b',
      createdAt: new Date('2026-10-03T10:00:00Z'),
      submittedData: { q1: 'nee ', q2: 'derde', mail: 'x@example.org' },
    },
    {
      id: 'id-a',
      createdAt: new Date('2026-10-03T10:00:00Z'),
      submittedData: { q2: 'vierde' },
    },
    {
      id: 'id-c',
      createdAt: new Date('2026-10-01T10:00:00Z'),
      submittedData: {},
    },
  ];
};

function createApp(user, extra = {}) {
  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    Object.assign(req, extra);
    next();
  });
  app.use('/project/:projectId(\\d+)/enquete', enqueteRouter);
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

const url = (projectId = PROJECT_ID, qs = '') =>
  `/project/${projectId}/enquete/${WIDGET_ID}${qs}`;
const editor = { role: 'editor', id: 1 };

describe('GET enquete stats map points', () => {
  beforeEach(() => {
    mapQuery = null;
    mapRows = [
      { point: '{"lat":52.2,"lng":5.3}' },
      { point: { lat: 52.1, lng: 5.9 } },
      { point: '{"lat":52.1,"lng":5.123456789}' },
      { point: '{}' },
    ];
  });

  it('returns sorted {lat,lng} pins, a 2001 limit and the area ids', async () => {
    const res = await request(createApp(editor)).get(url());
    expect(res.status).toBe(200);
    const map = res.body.questions.find((q) => q.fieldKey === 'loc');
    expect(map.chart).toBe('map');
    expect(map.points).toEqual([
      { lat: 52.1, lng: 5.12346 },
      { lat: 52.1, lng: 5.9 },
      { lat: 52.2, lng: 5.3 },
    ]);
    expect(Object.keys(map.points[0]).sort()).toEqual(['lat', 'lng']);
    expect(map.pointsTruncated).toBe(false);
    expect(map.areaIds).toEqual([5]);
    expect(mapQuery.limit).toBe(2001);
  });

  it('flags truncation above 2,000 points', async () => {
    mapRows = Array.from({ length: 2001 }, (_, i) => ({
      point: { lat: 52 + i / 100000, lng: 5 },
    }));
    const res = await request(createApp(editor)).get(url());
    const map = res.body.questions.find((q) => q.fieldKey === 'loc');
    expect(map.points).toHaveLength(2000);
    expect(map.pointsTruncated).toBe(true);
  });

  it('gives no points for an unsafe fieldKey', async () => {
    const res = await request(createApp(editor)).get(url());
    const evil = res.body.questions.find(
      (q) => q.type === 'map' && q.fieldKey !== 'loc'
    );
    expect(evil.points).toEqual([]);
  });

  it('keeps the auth matrix for map questions', async () => {
    expect(
      (await request(createApp({ role: 'editor', id: 3 })).get(url(2))).status
    ).toBe(404);
    expect(
      (await request(createApp({ role: 'member', id: 2 })).get(url())).status
    ).toBe(401);
    expect(
      (
        await request(
          createApp(editor, { reportingScope: { enabledComponents: [] } })
        ).get(url())
      ).status
    ).toBe(403);
    expect(mapQuery).toBeNull();
  });
});

describe('GET enquete stats', () => {
  beforeEach(() => {
    widgetWhere = null;
    submissionQuery = null;
    widgetExists = true;
  });

  it('returns 200 for an editor of the same project', async () => {
    const res = await request(createApp(editor)).get(url());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.questions[0].options[0]).toMatchObject({
      label: 'Ja',
      count: 1,
      percentage: 50,
    });
    expect(widgetWhere).toMatchObject({ type: 'enquete' });
  });

  it('returns 404 for a widget that is not in the project', async () => {
    const res = await request(createApp(editor)).get(url(2));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a deleted widget', async () => {
    widgetExists = false;
    const res = await request(createApp(editor)).get(url());
    expect(res.status).toBe(404);
  });

  it('returns 401 when the user is not an editor', async () => {
    const res = await request(createApp({ role: 'member', id: 2 })).get(url());
    expect(res.status).toBe(401);
  });

  it('returns 401 without a user', async () => {
    const res = await request(createApp(undefined)).get(url());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a reporting token', async () => {
    const res = await request(
      createApp(editor, { reportingScope: { enabledComponents: [] } })
    ).get(url());
    expect(res.status).toBe(403);
  });

  it.each([
    ['not a date', 'from=abc'],
    ['impossible day', 'from=2026-02-30&to=2026-03-01'],
    ['reversed', 'from=2026-10-12&to=2026-09-12'],
  ])('returns 400 for %s', async (_name, qs) => {
    const res = await request(createApp(editor)).get(url(PROJECT_ID, `?${qs}`));
    expect(res.status).toBe(400);
  });

  it('includes the whole "to" day and starts at "from" 00:00', async () => {
    await request(createApp(editor)).get(
      url(PROJECT_ID, '?from=2026-09-12&to=2026-10-12')
    );
    const { Op } = require('sequelize');
    const range = submissionQuery.where.createdAt;
    expect(range[Op.gte].toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(range[Op.lt].toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });

  it('asks only for safe columns and never leaks forbidden keys', async () => {
    const res = await request(createApp(editor)).get(url());
    expect(submissionQuery.attributes).toEqual([
      'id',
      'createdAt',
      'submittedData',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /ipAddress|embeddedUrl|userId|secret-id|geheim@example\.org/
    );
  });
});

const detailsUrl = (projectId = PROJECT_ID, qs = 'fieldKey=q2') =>
  `/project/${projectId}/enquete/${WIDGET_ID}/details?${qs}`;

describe('files upload over both routes', () => {
  it('summary preview has only name and a safe url', async () => {
    const res = await request(createApp(editor)).get(url());
    expect(res.status).toBe(200);
    const q = res.body.questions.find((x) => x.fieldKey === 'up');
    expect(q.chart).toBe('files');
    expect(q.fileCount).toBe(2);
    expect(q.preview).toEqual([
      { name: 'a.png', url: 'https://images.example.com/image/a.png' },
      { name: 'b.png', url: null },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /private-note|private-owner|javascript:/
    );
  });

  it('details rows carry files with only name and url', async () => {
    const res = await request(createApp(editor)).get(
      `${url(PROJECT_ID, '/details')}?fieldKey=up`
    );
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].files).toEqual([
      { name: 'a.png', url: 'https://images.example.com/image/a.png' },
      { name: 'b.png', url: null },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /private-note|private-owner|javascript:/
    );
  });

  it('keeps the reporting-token guard for uploads', async () => {
    const res = await request(createApp(editor, { reportingScope: {} })).get(
      `${url(PROJECT_ID, '/details')}?fieldKey=up`
    );
    expect(res.status).toBe(403);
  });
});

describe('GET enquete details', () => {
  beforeEach(() => {
    submissionQuery = null;
    widgetExists = true;
  });

  it('returns newest-first rows with only createdAt and answer', async () => {
    const res = await request(createApp(editor)).get(detailsUrl());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 25 });
    // same createdAt: id DESC breaks the tie (id-b before id-a)
    expect(res.body.rows.map((r) => r.answer)).toEqual([
      'derde',
      'vierde',
      'tweede',
    ]);
    expect(Object.keys(res.body.rows[0]).sort()).toEqual([
      'answer',
      'createdAt',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /secret-id|id-a|id-b|ipAddress|embeddedUrl|geheim/
    );
  });

  it('can sort oldest first and rejects a bad order', async () => {
    const asc = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q2&order=asc')
    );
    expect(asc.body.rows.map((r) => r.answer)).toEqual([
      'tweede',
      'vierde',
      'derde',
    ]);
    const bad = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q2&order=sideways')
    );
    expect(bad.status).toBe(400);
  });

  it('pages the results', async () => {
    const res = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q2&page=2&pageSize=2')
    );
    expect(res.body.total).toBe(3);
    expect(res.body.rows.map((r) => r.answer)).toEqual(['tweede']);
  });

  it('caps pageSize at 100', async () => {
    const res = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q2&pageSize=5000')
    );
    expect(res.body.pageSize).toBe(100);
  });

  it('shows the configured option label for choice questions', async () => {
    const res = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q1')
    );
    expect(res.body.rows.map((r) => r.answer).sort()).toEqual(['Ja', 'Nee']);
  });

  it('returns 400 for an unknown or missing fieldKey', async () => {
    for (const qs of ['fieldKey=nope', '']) {
      const res = await request(createApp(editor)).get(
        detailsUrl(PROJECT_ID, qs)
      );
      expect(res.status).toBe(400);
    }
  });

  it('returns 400 for bad paging numbers and dates', async () => {
    for (const qs of [
      'fieldKey=q2&page=abc',
      'fieldKey=q2&pageSize=-1',
      'fieldKey=q2&from=2026-02-30',
      'fieldKey=q2&from=2026-10-12&to=2026-09-12',
    ]) {
      const res = await request(createApp(editor)).get(
        detailsUrl(PROJECT_ID, qs)
      );
      expect(res.status).toBe(400);
    }
  });

  it('returns 403 for personal-data questions', async () => {
    const res = await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=mail')
    );
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('example.org');
  });

  it('has the same auth matrix as the summary', async () => {
    expect((await request(createApp(editor)).get(detailsUrl(2))).status).toBe(
      404
    );
    widgetExists = false;
    expect((await request(createApp(editor)).get(detailsUrl())).status).toBe(
      404
    );
    widgetExists = true;
    expect(
      (await request(createApp({ role: 'member', id: 2 })).get(detailsUrl()))
        .status
    ).toBe(401);
    expect((await request(createApp(undefined)).get(detailsUrl())).status).toBe(
      401
    );
    expect(
      (
        await request(
          createApp(editor, { reportingScope: { enabledComponents: [] } })
        ).get(detailsUrl())
      ).status
    ).toBe(403);
  });

  it('applies the date range with an inclusive "to" day', async () => {
    const { Op } = require('sequelize');
    await request(createApp(editor)).get(
      detailsUrl(PROJECT_ID, 'fieldKey=q2&from=2026-09-12&to=2026-10-12')
    );
    const range = submissionQuery.where.createdAt;
    expect(range[Op.gte].toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(range[Op.lt].toISOString()).toBe('2026-10-13T00:00:00.000Z');
  });
});
