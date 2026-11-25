import express from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
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
  findByPk: db.ProjectFolder.findByPk,
  userFindAll: db.User.findAll,
  projectFindAll: db.Project.findAll,
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
const superuser = { id: 3, role: 'superuser' };

let folderInstance;

describe('project-folder routes', () => {
  beforeEach(() => {
    db.sequelize.transaction = vi.fn(async (fn) => fn({ id: 'tx' }));
    db.Project.count = vi.fn(async ({ where }) => where.id[Op.in].length);
    db.Project.update = vi.fn(async () => [2]);
    db.ProjectFolder.create = vi.fn(async ({ name }) =>
      db.ProjectFolder.build({ id: 7, name })
    );
    db.ProjectFolder.findAll = vi.fn(async () => [
      db.ProjectFolder.build({ id: 2, name: 'Zebra' }),
      db.ProjectFolder.build({ id: 1, name: 'Appel' }),
    ]);
    db.User.findAll = vi.fn(async () => [{ projectId: 10 }]);
    db.Project.findAll = vi.fn(async () => [{ folderId: 2 }]);
    folderInstance = db.ProjectFolder.build({ id: 5, name: 'Oud' });
    folderInstance.update = vi.fn(async function (values) {
      Object.assign(this, values);
      return this;
    });
    folderInstance.destroy = vi.fn(async () => {});
    db.ProjectFolder.findByPk = vi.fn(async (id) =>
      id === 5 ? folderInstance : null
    );
  });

  afterEach(() => {
    db.ProjectFolder.findByPk = originals.findByPk;
    db.sequelize.transaction = originals.transaction;
    db.Project.count = originals.count;
    db.Project.update = originals.update;
    db.ProjectFolder.create = originals.create;
    db.ProjectFolder.findAll = originals.findAll;
    db.User.findAll = originals.userFindAll;
    db.Project.findAll = originals.projectFindAll;
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

  describe('GET /project-folder visibility', () => {
    const list = (user) => request(createApp(user)).get('/project-folder');

    it('shows a superuser every folder, including empty ones', async () => {
      const res = await list(superuser);

      expect(res.status).toBe(200);
      expect(res.body.map((f) => f.name)).toEqual(['Appel', 'Zebra']);
      expect(db.User.findAll).not.toHaveBeenCalled();
      expect(db.Project.findAll).not.toHaveBeenCalled();
    });

    it('shows an admin only folders with their own projects, sorted', async () => {
      const res = await list(admin);

      expect(res.status).toBe(200);
      expect(res.body.map((f) => f.name)).toEqual(['Zebra']);
      expect(db.Project.findAll).toHaveBeenCalledWith({
        where: { id: { [Op.in]: [10] }, folderId: { [Op.ne]: null } },
        attributes: ['folderId'],
      });
    });

    it('shows an editor only folders with their own projects', async () => {
      db.Project.findAll = vi.fn(async () => [
        { folderId: 1 },
        { folderId: 2 },
      ]);
      db.User.findAll = vi.fn(async () => [
        { projectId: 10 },
        { projectId: 11 },
      ]);

      const res = await list(editor);

      expect(res.body.map((f) => f.name)).toEqual(['Appel', 'Zebra']);
    });

    it('hides a folder for an editor whose only project in it is project 1', async () => {
      db.User.findAll = vi.fn(async () => [
        { projectId: 1 },
        { projectId: 10 },
      ]);

      const res = await list(editor);

      expect(res.status).toBe(200);
      const where = db.Project.findAll.mock.calls[0][0].where;
      expect(where.id[Op.in]).toEqual([10]);
    });

    it('returns [] for an editor whose only project is project 1', async () => {
      db.User.findAll = vi.fn(async () => [{ projectId: 1 }]);

      const res = await list(editor);

      expect(res.body).toEqual([]);
      expect(db.Project.findAll).not.toHaveBeenCalled();
    });

    it('returns [] without querying projects for a user with no projects', async () => {
      db.User.findAll = vi.fn(async () => []);

      const res = await list(admin);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      expect(db.Project.findAll).not.toHaveBeenCalled();
    });

    it('passes a database error on as a 500', async () => {
      db.User.findAll = vi.fn(async () => {
        throw new Error('boom');
      });

      const res = await list(admin);

      expect(res.status).toBe(500);
    });
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

    it('lets an admin list the folders with their own projects', async () => {
      const res = await request(createChainApp(admin)).get(
        '/api/project-folder'
      );

      expect(res.status).toBe(200);
      expect(res.body.map((f) => f.name)).toEqual(['Zebra']);
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

  describe('DELETE /project-folder/:id', () => {
    const del = (user, id = 5) =>
      request(createApp(user)).delete(`/project-folder/${id}`);

    it('deletes the folder for an admin', async () => {
      const res = await del(admin);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ projectFolder: 'deleted' });
      expect(folderInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('clears folderId before destroying the folder', async () => {
      await del(admin);

      const clearOrder = db.Project.update.mock.invocationCallOrder[0];
      const destroyOrder = folderInstance.destroy.mock.invocationCallOrder[0];
      expect(clearOrder).toBeLessThan(destroyOrder);
      expect(db.Project.update).toHaveBeenCalledWith(
        { folderId: null },
        expect.objectContaining({
          where: { folderId: 5 },
          paranoid: false,
        })
      );
    });

    it('uses the same transaction for both writes', async () => {
      await del(admin);

      const tx = { id: 'tx' };
      expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
      expect(db.Project.update.mock.calls[0][1].transaction).toEqual(tx);
      expect(folderInstance.destroy).toHaveBeenCalledWith({ transaction: tx });
    });

    it('does not let an editor delete a folder', async () => {
      const res = await del(editor);

      expect(res.status).toBe(403);
      expect(folderInstance.destroy).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown folder', async () => {
      const res = await del(admin, 99);

      expect(res.status).toBe(404);
      expect(folderInstance.destroy).not.toHaveBeenCalled();
    });
  });

  describe('PUT /project-folder/:id', () => {
    const put = (user, body, id = 5) =>
      request(createApp(user)).put(`/project-folder/${id}`).send(body);

    it('renames without projectIds and leaves the projects untouched', async () => {
      const res = await put(admin, { name: 'Nieuw' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nieuw');
      expect(db.Project.update).not.toHaveBeenCalled();
      expect(db.Project.count).not.toHaveBeenCalled();
    });

    it('moves listed projects in and clears the ones left out', async () => {
      const res = await put(admin, { name: 'Nieuw', projectIds: [3, 4] });

      expect(res.status).toBe(200);
      const [clear, add] = db.Project.update.mock.calls;
      expect(clear[0]).toEqual({ folderId: null });
      expect(clear[1].where.folderId).toBe(5);
      expect(clear[1].where.id).toBeDefined();
      expect(clear[1].paranoid).toBe(false);
      expect(add[0]).toEqual({ folderId: 5 });
    });

    it('clears the whole folder for an empty list without Op.notIn', async () => {
      const res = await put(admin, { name: 'Nieuw', projectIds: [] });

      expect(res.status).toBe(200);
      expect(db.Project.update).toHaveBeenCalledTimes(1);
      const [values, options] = db.Project.update.mock.calls[0];
      expect(values).toEqual({ folderId: null });
      expect(options.where).toEqual({ folderId: 5 });
    });

    it('moves a project in that sits in another folder', async () => {
      const res = await put(admin, { name: 'Nieuw', projectIds: [9] });

      expect(res.status).toBe(200);
      expect(db.Project.update).toHaveBeenLastCalledWith(
        { folderId: 5 },
        expect.objectContaining({ transaction: { id: 'tx' } })
      );
      const add = db.Project.update.mock.calls[1][1];
      expect(add.where.folderId).toBeUndefined();
    });

    it('rejects an empty name with 400', async () => {
      const res = await put(admin, { name: ' ', projectIds: [3] });

      expect(res.status).toBe(400);
      expect(folderInstance.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown project with 400 and saves nothing', async () => {
      db.Project.count = vi.fn(async () => 1);

      const res = await put(admin, { name: 'X', projectIds: [3, 999] });

      expect(res.status).toBe(400);
      expect(folderInstance.update).not.toHaveBeenCalled();
      expect(db.Project.update).not.toHaveBeenCalled();
    });

    it('does not let an editor update a folder', async () => {
      const res = await put(editor, { name: 'Nope' });

      expect(res.status).toBe(403);
      expect(db.ProjectFolder.findByPk).not.toHaveBeenCalled();
      expect(folderInstance.update).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown folder', async () => {
      const res = await put(admin, { name: 'X' }, 99);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Map niet gevonden');
    });

    it('uses the same transaction for every write', async () => {
      await put(admin, { name: 'Nieuw', projectIds: [3] });

      const tx = { id: 'tx' };
      expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
      expect(folderInstance.update).toHaveBeenCalledWith(
        { name: 'Nieuw' },
        { transaction: tx }
      );
      for (const call of db.Project.update.mock.calls) {
        expect(call[1].transaction).toEqual(tx);
      }
    });
  });
});

describe('project list', () => {
  it('exposes folderId to editors', () => {
    const project = db.Project.build({ id: 1, name: 'P', folderId: 5 });
    expect(project.toJSON({ role: 'editor' }).folderId).toBe(5);
  });
});
