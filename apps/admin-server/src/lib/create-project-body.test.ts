import { describe, expect, it } from 'vitest';

import {
  buildCreateProjectBody,
  readCreatedProject,
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

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('readCreatedProject', () => {
  it('returns the new project', async () => {
    await expect(
      readCreatedProject(response(201, { id: 41, name: 'Plan' }))
    ).resolves.toEqual({ id: 41, name: 'Plan' });
  });

  it('throws the API message for a rejected folder', async () => {
    await expect(
      readCreatedProject(response(400, { message: 'Map bestaat niet' }))
    ).rejects.toThrow('Map bestaat niet');
  });

  it.each([403, 500])('throws the no-access message for %i', async (status) => {
    await expect(
      readCreatedProject(response(status, { message: 'You cannot do this' }))
    ).rejects.toThrow('Je hebt geen toegang tot deze actie.');
  });

  it('throws when the answer has no id', async () => {
    await expect(readCreatedProject(response(200, {}))).rejects.toThrow(
      'Er is helaas iets mis gegaan.'
    );
  });
});
