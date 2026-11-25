import useSWR from 'swr';

type paramsType = {
  projectsWithIssues?: boolean;
  includeCounts?: boolean;
};

export const PROJECT_LIST_KEY = '/api/openstad/api/project?includeConfig=1';
export const PROJECT_LIST_WITH_COUNTS_KEY = `${PROJECT_LIST_KEY}&includeCounts=1`;

export default function useProjectList(params?: paramsType) {
  let projectListSwrKey = params?.includeCounts
    ? PROJECT_LIST_WITH_COUNTS_KEY
    : PROJECT_LIST_KEY;

  if (params?.projectsWithIssues) {
    projectListSwrKey = `/api/openstad/api/project/issues`;
  }

  let projectListSwr = useSWR(projectListSwrKey);
  return { ...projectListSwr };
}
