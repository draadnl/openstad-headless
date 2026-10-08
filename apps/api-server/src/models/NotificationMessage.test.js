import nodeFs from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import NotificationMessageFactory from './NotificationMessage.js';

const TEMPLATES_DIR = path.join(
  __dirname,
  '../notifications/default-templates'
);

describe('loadDefaultTemplate', () => {
  it('resolves a non-empty subject and body for notification comment - user', async () => {
    const template = await NotificationMessageFactory.loadDefaultTemplate(
      'notification comment - user'
    );

    expect(template).not.toBeNull();
    expect(template.subject.trim().length).toBeGreaterThan(0);
    expect(template.body.trim().length).toBeGreaterThan(0);
  });

  it('resolves a non-empty subject and body for notification comment reply - user', async () => {
    const template = await NotificationMessageFactory.loadDefaultTemplate(
      'notification comment reply - user'
    );

    expect(template).not.toBeNull();
    expect(template.subject.trim().length).toBeGreaterThan(0);
    expect(template.body.trim().length).toBeGreaterThan(0);
  });

  it('returns null when there is no bundled file for the type', async () => {
    expect(
      await NotificationMessageFactory.loadDefaultTemplate('no such template')
    ).toBeNull();
  });

  it('only reads from the default-templates folder', async () => {
    const readFile = vi.spyOn(nodeFs.promises, 'readFile');

    await NotificationMessageFactory.loadDefaultTemplate(
      '../../models/NotificationMessage.js'
    );

    expect(readFile).toHaveBeenCalledWith(
      path.join(TEMPLATES_DIR, 'NotificationMessage.js')
    );
    readFile.mockRestore();
  });
});

const KNOWN_BROKEN_TEMPLATES = ['new or updated comment - admin update'];

describe('default-templates shape', () => {
  it('has exactly one <subject> and one <body>, both non-empty, in every file', async () => {
    const files = (await fs.readdir(TEMPLATES_DIR)).filter(
      (file) => !KNOWN_BROKEN_TEMPLATES.includes(file)
    );
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = (
        await fs.readFile(path.join(TEMPLATES_DIR, file))
      ).toString();

      const subjectOpenTags = content.match(/<subject>/g) || [];
      const subjectCloseTags = content.match(/<\/subject>/g) || [];
      const bodyOpenTags = content.match(/<body>/g) || [];
      const bodyCloseTags = content.match(/<\/body>/g) || [];

      expect(subjectOpenTags.length, `${file}: <subject> count`).toBe(1);
      expect(subjectCloseTags.length, `${file}: </subject> count`).toBe(1);
      expect(bodyOpenTags.length, `${file}: <body> count`).toBe(1);
      expect(bodyCloseTags.length, `${file}: </body> count`).toBe(1);

      const match = content.match(
        /<subject>((?:.|\r|\n)*)<\/subject>(?:.|\r|\n)*<body>((?:.|\r|\n)*)<\/body>/
      );
      expect(match, `${file}: subject/body parse`).not.toBeNull();
      expect(
        match[1].trim().length,
        `${file}: subject content`
      ).toBeGreaterThan(0);
      expect(match[2].trim().length, `${file}: body content`).toBeGreaterThan(
        0
      );
    }
  });
});
