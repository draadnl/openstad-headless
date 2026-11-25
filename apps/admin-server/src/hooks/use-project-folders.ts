import useSWR, { useSWRConfig } from 'swr';

export type ProjectFolder = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const foldersUrl = '/api/openstad/api/project-folder';
const projectListUrl = '/api/openstad/api/project?includeConfig=1';

export default function useProjectFolders() {
  const foldersSwr = useSWR<ProjectFolder[]>(foldersUrl);
  const { mutate } = useSWRConfig();

  async function createFolder(name: string, projectIds: number[]) {
    const res = await fetch(foldersUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, projectIds }),
    });

    if (!res.ok) {
      throw new Error('Kon de map niet aanmaken');
    }

    const folder = await res.json();
    await Promise.all([foldersSwr.mutate(), mutate(projectListUrl)]);
    return folder;
  }

  return { ...foldersSwr, createFolder };
}
