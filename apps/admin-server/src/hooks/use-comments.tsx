import useSWR from 'swr';

export default function useComments(projectId?: string) {
  const url = `/api/openstad/api/project/${projectId}/comment`;

  const commentListSwr = useSWR(projectId ? url : null);

  return {...commentListSwr}
}