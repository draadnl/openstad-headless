import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';

const require = createRequire(import.meta.url);
const db = require('../../db');
const projectFolderRouter = require('./project-folder');

const originals = {
  transaction: db.sequelize.transaction,
  count: db.Project.count,
  update: db.Project.update,
  create: db.ProjectFolder.create,
  findAll: db.ProjectFolder.findAll,
};

function createApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    next();
  });
  app.use('/project-folder', projectFolderRouter);
  app.use((err, req, res, next) => {
    const status = err.status || (/cannot/i.test(err.message) ? 403 : 500);
    res.status(status).json({ error: err.message });
  });
  return app;
}

const admin = { id: 1, role: 'admin' };
const editor = { id: 2, role: 'editor' };

describe('project-folder routes', () => {
  beforeEach(() => {
    db.sequelize.transaction = vi.fn(async (fn) => fn({ id: 'tx' }));
    db.Project.count = vi.fn(async () => 2);
    db.Project.update = vi.fn(async () => [2]);
    db.ProjectFolder.create = vi.fn(async ({ name }) =>
      db.ProjectFolder.build({ id: 7, name })
    );
    db.ProjectFolder.findAll = vi.fn(async () => [
      db.ProjectFolder.build({ id: 2, name: 'Zebra' }),
      db.ProjectFolder.build({ id: 1, name: 'Appel' }),
    ]);
  });

  afterEach(() => {
    db.sequelize.transaction = originals.transaction;
    db.Project.count = originals.count;
    db.Project.update = originals.update;
    db.ProjectFolder.create = originals.create;
    db.ProjectFolder.findAll = originals.findAll;
  });

  it('creates a folder and moves the projects in one transaction', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'Templates', projectIds: [3, 4] });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Templates');
    expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(db.Project.update).toHaveBeenCalledWith(
      { folderId: 7 },
      expect.objectContaining({ transaction: { id: 'tx' } })
    );
  });

  it('creates an empty folder without touching projects', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'Leeg' });

    expect(res.status).toBe(201);
    expect(db.Project.update).not.toHaveBeenCalled();
  });

  it('rejects an empty name with 400', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: '   ', projectIds: [] });

    expect(res.status).toBe(400);
    expect(db.ProjectFolder.create).not.toHaveBeenCalled();
  });

  it('rejects a name that is only HTML tags with 400', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: '<b></b>' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Geen naam opgegeven');
    expect(db.ProjectFolder.create).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 255 characters with 400', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Naam is te lang');
    expect(db.ProjectFolder.create).not.toHaveBeenCalled();
  });

  it('accepts a name of exactly 255 characters', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'a'.repeat(255) });

    expect(res.status).toBe(201);
  });

  it('strips HTML tags from the name before saving', async () => {
    await request(createApp(admin))
      .post('/project-folder')
      .send({ name: '<b>Wijk</b>' });

    expect(db.ProjectFolder.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Wijk' }),
      expect.anything()
    );
  });

  it('rejects projectIds that are not whole numbers', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'X', projectIds: ['abc'] });

    expect(res.status).toBe(400);
  });

  it('rejects projectIds that are not a list', async () => {
    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'X', projectIds: 5 });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown project id and saves nothing', async () => {
    db.Project.count = vi.fn(async () => 1);

    const res = await request(createApp(admin))
      .post('/project-folder')
      .send({ name: 'X', projectIds: [3, 999] });

    expect(res.status).toBe(400);
    expect(db.ProjectFolder.create).not.toHaveBeenCalled();
    expect(db.Project.update).not.toHaveBeenCalled();
  });

  it('does not let an editor create a folder', async () => {
    const res = await request(createApp(editor))
      .post('/project-folder')
      .send({ name: 'Nope' });

    expect(res.status).toBe(403);
    expect(db.ProjectFolder.create).not.toHaveBeenCalled();
  });

  it('lists folders sorted by name for an editor', async () => {
    const res = await request(createApp(editor)).get('/project-folder');

    expect(res.status).toBe(200);
    expect(res.body.map((f) => f.name)).toEqual(['Appel', 'Zebra']);
  });

  it('does not let an anonymous user list folders', async () => {
    const res = await request(createApp({ role: 'anonymous' })).get(
      '/project-folder'
    );

    expect(res.status).toBe(403);
  });

  describe('through the project middleware', () => {
    function createChainApp(user) {
      const app = express();
      app.use(require('../../middleware/project'));
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = user;
        next();
      });
      app.use('/api/project-folder', projectFolderRouter);
      app.use((err, req, res, next) => {
        const status = err.status || (/cannot/i.test(err.message) ? 403 : 500);
        res.status(status).json({ error: err.message });
      });
      return app;
    }

    it('lets an admin list folders', async () => {
      const res = await request(createChainApp(admin)).get(
        '/api/project-folder'
      );

      expect(res.status).toBe(200);
      expect(res.body.map((f) => f.name)).toEqual(['Appel', 'Zebra']);
    });

    it('lets an admin create a folder', async () => {
      const res = await request(createChainApp(admin))
        .post('/api/project-folder')
        .send({ name: 'Templates', projectIds: [3, 4] });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Templates');
    });

    it('still rejects an editor creating a folder', async () => {
      const res = await request(createChainApp(editor))
        .post('/api/project-folder')
        .send({ name: 'Nope' });

      expect(res.status).toBe(403);
      expect(db.ProjectFolder.create).not.toHaveBeenCalled();
    });
  });
});

describe('project list', () => {
  it('exposes folderId to editors', () => {
    const project = db.Project.build({ id: 1, name: 'P', folderId: 5 });
    expect(project.toJSON({ role: 'editor' }).folderId).toBe(5);
  });
});
