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

const originalScope = db.Project.scope;

afterEach(() => {
  db.Project.scope = originalScope;
});

function runSetScope(query) {
  const req = { query };
  const next = vi.fn();
  ctrl.setScope(req, {}, next);
  return req;
}

async function runList(query) {
  const findAndCountAll = vi.fn(async () => ({ rows: [], count: 0 }));
  db.Project.scope = vi.fn(() => ({ findAndCountAll }));
  const req = {
    query,
    user: { id: 1, role: 'superuser' },
    dbQuery: { offset: 0, limit: 10 },
  };
  ctrl.setScope(req, {}, () => {});
  await ctrl.listProjects(req, {}, vi.fn());
  return findAndCountAll.mock.calls[0][0];
}

describe('setScope includeCounts flag', () => {
  it.each(['1', 'true'])('sets the flag for %j', (v) => {
    expect(runSetScope({ includeCounts: v }).includeCounts).toBe(true);
  });

  it('leaves the flag off without the param', () => {
    expect(runSetScope({}).includeCounts).toBe(false);
  });

  it('does not add a Sequelize scope for it', () => {
    expect(runSetScope({ includeCounts: '1' }).scope).not.toContain(
      'includeCounts'
    );
  });
});

describe('listProjects widgetCount', () => {
  it('adds a widgetCount include when the flag is on', async () => {
    const opts = await runList({ includeCounts: '1' });
    expect(opts.attributes.include).toHaveLength(1);
    expect(opts.attributes.include[0][1]).toBe('widgetCount');
  });

  it('passes no attributes key without the flag', async () => {
    const opts = await runList({});
    expect(opts).not.toHaveProperty('attributes');
  });

  it('adds no widgetCount with getBasicInformation', async () => {
    const opts = await runList({
      includeCounts: '1',
      getBasicInformation: '1',
    });
    expect(opts).not.toHaveProperty('attributes');
  });
});
