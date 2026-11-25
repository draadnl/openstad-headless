import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

process.env.NODE_CONFIG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config'
);
process.env.SUPPRESS_NO_CONFIG_WARNING = '1';

const require = createRequire(import.meta.url);
const db = require('../db');

describe('ProjectFolder model', () => {
  it('sanitizes and trims the name', () => {
    const folder = db.ProjectFolder.build({
      name: '  <script>alert(1)</script>Templates  ',
    });
    expect(folder.name).not.toContain('<script>');
    expect(folder.name).toContain('Templates');
  });

  it('turns a whitespace-only name into an empty string', () => {
    expect(db.ProjectFolder.build({ name: '   ' }).name).toBe('');
  });

  it('lets editors list but only admins change folders', () => {
    expect(db.ProjectFolder.auth).toMatchObject({
      listableBy: 'editor',
      createableBy: 'admin',
      updateableBy: 'admin',
      deleteableBy: 'admin',
    });
  });

  it('is soft-deleted (paranoid)', () => {
    expect(db.ProjectFolder.options.paranoid).toBe(true);
  });

  it('links a project to a folder through folderId', () => {
    expect(db.Project.associations.project_folder).toBeDefined();
    expect(db.Project.rawAttributes.folderId).toBeDefined();
  });
});
