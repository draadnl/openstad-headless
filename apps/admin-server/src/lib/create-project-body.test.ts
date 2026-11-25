import { describe, expect, it } from 'vitest';

import {
  buildCreateProjectBody,
  createProjectOutcome,
} from './create-project-body';

describe('buildCreateProjectBody', () => {
  it.each([undefined, null, 0, -1, 1.5])(
    'has no targetFolderId for %j',
    (v) => {
      expect(buildCreateProjectBody('Plan', v as any)).not.toHaveProperty(
        'targetFolderId'
      );
    }
  );

  it('adds targetFolderId for 5', () => {
    expect(buildCreateProjectBody('Plan', 5).targetFolderId).toBe(5);
  });

  it('keeps the name and auth config', () => {
    const body = buildCreateProjectBody('Plan', 5);
    expect(body.name).toBe('Plan');
    expect(body.config.auth.provider.openstad.name).toBe('Plan normal');
    expect(body.config.auth.provider.anonymous.authTypes).toBe('Anonymous');
  });
});

describe('createProjectOutcome', () => {
  it('passes the new project id on', () => {
    expect(createProjectOutcome({ id: 41, name: 'Plan' })).toEqual({
      ok: true,
      id: 41,
    });
  });

  it('shows the API message for a rejected folder', () => {
    expect(
      createProjectOutcome({ status: 400, message: 'Map bestaat niet' })
    ).toEqual({ ok: false, message: 'Map bestaat niet' });
  });

  it('keeps the no-access message for a 500', () => {
    expect(
      createProjectOutcome({ status: 500, message: 'You cannot do this' })
    ).toEqual({ ok: false, message: 'Je hebt geen toegang tot deze actie.' });
  });

  it.each([null, undefined, {}, ''])('fails without an id for %j', (v) => {
    expect(createProjectOutcome(v)).toEqual({
      ok: false,
      message: 'Er is helaas iets mis gegaan.',
    });
  });
});
