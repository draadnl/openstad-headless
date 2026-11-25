import useSWR, { type SWRConfiguration, useSWRConfig } from 'swr';

import {
  PROJECT_LIST_KEY,
  PROJECT_LIST_WITH_COUNTS_KEY,
} from './use-project-list';

export type ProjectFolder = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const foldersUrl = '/api/openstad/api/project-folder';

export default function useProjectFolders(
  options?: SWRConfiguration<ProjectFolder[]>
) {
  const foldersSwr = useSWR<ProjectFolder[]>(foldersUrl, options);
  const { mutate } = useSWRConfig();

  const refreshProjectLists = () =>
    Promise.all([
      mutate(PROJECT_LIST_KEY),
      mutate(PROJECT_LIST_WITH_COUNTS_KEY),
    ]);

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
    await Promise.all([foldersSwr.mutate(), refreshProjectLists()]);
    return folder;
  }

  async function updateFolder(id: number, name: string, projectIds: number[]) {
    const res = await fetch(`${foldersUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, projectIds }),
    });

    if (!res.ok) {
      throw new Error('Kon de map niet opslaan');
    }

    const folder = await res.json();
    await Promise.all([foldersSwr.mutate(), refreshProjectLists()]);
    return folder;
  }

  async function deleteFolder(id: number) {
    const res = await fetch(`${foldersUrl}/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      throw new Error('Kon de map niet verwijderen');
    }

    await Promise.all([foldersSwr.mutate(), refreshProjectLists()]);
  }

  return { ...foldersSwr, createFolder, updateFolder, deleteFolder };
}
