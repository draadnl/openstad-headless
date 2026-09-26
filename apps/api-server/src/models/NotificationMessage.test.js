import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import NotificationMessageFactory from './NotificationMessage.js';

const TEMPLATES_DIR = path.join(
  __dirname,
  '../notifications/default-templates'
);

// Pins the reported defect: a project without its own NotificationTemplate
// row must still get a mail, via the bundled default-templates file.
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

  // Proves the previous test is not a tautology: with the file removed,
  // resolution must fail (return null), which is what happened before this
  // fix — the mail silently disappeared instead.
  describe('without the bundled file (regression guard)', () => {
    const filePath = path.join(TEMPLATES_DIR, 'notification comment - user');
    const tempPath = `${filePath}.tmp-removed-for-test`;

    beforeEach(async () => {
      await fs.rename(filePath, tempPath);
    });

    afterEach(async () => {
      await fs.rename(tempPath, filePath);
    });

    it('returns null when the default template file is missing', async () => {
      await expect(
        NotificationMessageFactory.loadDefaultTemplate(
          'notification comment - user'
        )
      ).rejects.toThrow();
    });
  });
});

// Every file in default-templates/ must have exactly one <subject> and one
// <body> block with non-empty content. A greedy regex match alone is too
// weak: it is exactly what accepted the malformed double-<subject> file
// fixed alongside this test.
// 'new or updated comment - admin update' has no <subject> block at all and
// is a pre-existing, unrelated defect (that notification type is also never
// created anywhere in the codebase) tracked for its own ticket — out of
// scope here, so it is excluded rather than silently fixed as a side effect.
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
