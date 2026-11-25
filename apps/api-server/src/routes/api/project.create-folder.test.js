import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';

const require = createRequire(import.meta.url);
const db = require('../../db');
const ctrl = require('../../controllers/projectController');

const originals = {
  findByPk: db.ProjectFolder.findByPk,
  create: db.Project.create,
};

const admin = { id: 1, role: 'admin' };
const editor = { id: 2, role: 'editor' };

afterEach(() => {
  db.ProjectFolder.findByPk = originals.findByPk;
  db.Project.create = originals.create;
});

async function run(body, user = admin, found = true) {
  db.ProjectFolder.findByPk = vi.fn(async (id) => (found ? { id } : null));
  const req = { body, user };
  const next = vi.fn();
  await ctrl.validateTargetFolder(req, {}, next);
  return { req, next, err: next.mock.calls[0][0] };
}

describe('validateTargetFolder', () => {
  it.each([undefined, null, ''])('treats %j as no folder', async (v) => {
    const { req, err } = await run({ name: 'x', targetFolderId: v });
    expect(err).toBeUndefined();
    expect(req.targetFolderId).toBeUndefined();
    expect(req.body).not.toHaveProperty('targetFolderId');
  });

  it.each([5, '5'])('accepts %j', async (v) => {
    const { req, err } = await run({ targetFolderId: v });
    expect(err).toBeUndefined();
    expect(req.targetFolderId).toBe(5);
    expect(req.body).not.toHaveProperty('targetFolderId');
  });

  it.each([0, -1, 1.5, 'abc', true])('rejects %j with 400', async (v) => {
    const { err } = await run({ targetFolderId: v });
    expect(err.status).toBe(400);
  });

  it('rejects an unknown folder with 400', async () => {
    const { err } = await run({ targetFolderId: 9 }, admin, false);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Map bestaat niet');
  });

  it('ignores the field for duplicate requests without a lookup', async () => {
    const { req, err } = await run({
      targetFolderId: 5,
      isDuplicateRequest: true,
    });
    expect(err).toBeUndefined();
    expect(req.targetFolderId).toBeUndefined();
    expect(req.body).not.toHaveProperty('targetFolderId');
    expect(db.ProjectFolder.findByPk).not.toHaveBeenCalled();
  });

  it('rejects non-admins with 403', async () => {
    const { err } = await run({ targetFolderId: 5 }, editor);
    expect(err.status).toBe(403);
  });
});

describe('createProjectRecord folder handling', () => {
  async function create(req) {
    db.Project.create = vi.fn(() => Promise.reject(new Error('stop')));
    await new Promise((resolve) => ctrl.createProjectRecord(req, {}, resolve));
    return db.Project.create.mock.calls[0][0];
  }

  it('passes the validated target folder', async () => {
    const arg = await create({ body: { name: 'x' }, targetFolderId: 5 });
    expect(arg.folderId).toBe(5);
    expect(arg).not.toHaveProperty('targetFolderId');
  });

  it('never copies a folderId from the body', async () => {
    const arg = await create({ body: { name: 'x', folderId: 9 } });
    expect(arg.folderId).toBeNull();
  });
});
