import { readSaved } from '@/lib/read-json';

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

export async function readCreatedProject(res: Response) {
  if (res.status === 403 || res.status === 500)
    throw new Error('Je hebt geen toegang tot deze actie.');
  const project = await readSaved(
    res,
    'Het project kon niet worden aangemaakt.'
  );
  if (!project?.id) throw new Error('Er is helaas iets mis gegaan.');
  return project;
}
