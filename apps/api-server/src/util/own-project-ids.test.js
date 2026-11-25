import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';

const require = createRequire(import.meta.url);
const db = require('../db');
const { findOwnProjectIds } = require('./own-project-ids');

const originalFindAll = db.User.findAll;

describe('findOwnProjectIds', () => {
  beforeEach(() => {
    db.User.findAll = vi.fn();
  });

  afterEach(() => {
    db.User.findAll = originalFindAll;
  });

  it('returns null for a superuser without querying', async () => {
    const result = await findOwnProjectIds({ role: 'superuser' });
    expect(result).toBeNull();
    expect(db.User.findAll).not.toHaveBeenCalled();
  });

  it('returns the project ids of admin/editor rows', async () => {
    db.User.findAll.mockResolvedValue([{ projectId: 2 }, { projectId: 5 }]);
    const user = {
      role: 'admin',
      idpUser: { identifier: 'abc', provider: 'openstad' },
    };

    const result = await findOwnProjectIds(user);

    expect(result).toEqual([2, 5]);
    expect(db.User.findAll).toHaveBeenCalledWith({
      where: {
        idpUser: { identifier: 'abc', provider: 'openstad' },
        [Op.or]: [{ role: 'admin' }, { role: 'editor' }],
      },
    });
  });

  it('uses the fallback strings when the user has no idpUser', async () => {
    db.User.findAll.mockResolvedValue([]);

    await findOwnProjectIds({ role: 'editor' });

    expect(db.User.findAll.mock.calls[0][0].where.idpUser).toEqual({
      identifier: 'no identifier found',
      provider: 'no provider found',
    });
  });

  it('returns an empty array when there are no rows', async () => {
    db.User.findAll.mockResolvedValue([]);
    const result = await findOwnProjectIds({
      role: 'admin',
      idpUser: { identifier: 'x', provider: 'y' },
    });
    expect(result).toEqual([]);
  });
});
