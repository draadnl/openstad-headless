import useSWR from 'swr';

/**
 * Access to the single global settings row. Pass a projectId from a project page: reading
 * then uses the project scoped route, which an editor may call. The unscoped route is
 * admin-only and answers a 500 for them. Updating always uses the unscoped route.
 */
export function useGlobalSettings(projectId?: string | number) {
  const readUrl = projectId
    ? `/api/openstad/api/project/${projectId}/global-settings`
    : '/api/openstad/api/global-settings';

  const globalSettingsSwr = useSWR(readUrl);

  async function updateGlobalSettings(payload: {
    config?: any;
    emailConfig?: any;
  }) {
    const res = await fetch('/api/openstad/api/global-settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      globalSettingsSwr.mutate(data);
    }

    return { ok: res.ok, data };
  }

  return {
    ...globalSettingsSwr,
    updateGlobalSettings,
  };
}
