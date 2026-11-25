export function buildCreateProjectBody(
  name: string,
  targetFolderId?: number | null
) {
  return {
    name,
    config: {
      auth: {
        provider: {
          openstad: {
            name: `${name} normal`,
            adapter: 'openstad',
            authTypes: 'Url',
          },
          anonymous: {
            name: `${name} anonymous`,
            adapter: 'openstad',
            authTypes: 'Anonymous',
            requiredUserFields: 'postcode',
          },
        },
      },
    },
    ...(Number.isInteger(targetFolderId) && (targetFolderId as number) >= 1
      ? { targetFolderId }
      : {}),
  };
}

export type CreateProjectOutcome =
  | { ok: true; id: number | string }
  | { ok: false; message: string };

export function createProjectOutcome(result: any): CreateProjectOutcome {
  if (result?.status === 500) {
    return { ok: false, message: 'Je hebt geen toegang tot deze actie.' };
  }
  if (typeof result?.status === 'number' && result.status >= 400) {
    return {
      ok: false,
      message: result.message || 'Er is helaas iets mis gegaan.',
    };
  }
  const id = result?.id ?? result;
  if (typeof id === 'number' || (typeof id === 'string' && id !== '')) {
    return { ok: true, id };
  }
  return { ok: false, message: 'Er is helaas iets mis gegaan.' };
}
