import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate every cache that mirrors data from a single project.
 * Includes the bundled `projectOverview` so the seeding effect in
 * ProjectDetail can't overwrite freshly invalidated per-resource caches.
 */
export function invalidateProjectScope(
  queryClient: QueryClient,
  projectId: number | string | undefined,
) {
  if (projectId === undefined || projectId === null) return;
  const id = projectId;
  queryClient.invalidateQueries({ queryKey: ['project', id] });
  queryClient.invalidateQueries({ queryKey: ['project', id, 'links'] });
  queryClient.invalidateQueries({ queryKey: ['projectOverview', id] });
  queryClient.invalidateQueries({ queryKey: ['sprints', id] });
  queryClient.invalidateQueries({ queryKey: ['hubData', id, 'goals'] });
  queryClient.invalidateQueries({ queryKey: ['hubData', id, 'milestones'] });
  queryClient.invalidateQueries({ queryKey: ['hubData', id, 'activities'] });
  queryClient.invalidateQueries({ queryKey: ['hubData', id, 'analytics'] });
  queryClient.invalidateQueries({ queryKey: ['hubData', id, 'prd'] });
}

/**
 * Invalidate every cache that mirrors work-item data for a project.
 * Includes board+hub workitem lists, myTasks, single-item detail prefix,
 * and the analytics + activities hub caches that change when work items move.
 */
export function invalidateWorkItemScope(
  queryClient: QueryClient,
  projectId: number | string | undefined,
) {
  queryClient.invalidateQueries({ queryKey: ['workItems'] }); // prefix matches board+hub
  queryClient.invalidateQueries({ queryKey: ['workItem'] }); // prefix matches all single-item detail/comments
  queryClient.invalidateQueries({ queryKey: ['myTasks'] });
  if (projectId !== undefined && projectId !== null) {
    queryClient.invalidateQueries({ queryKey: ['hubData', projectId, 'analytics'] });
    queryClient.invalidateQueries({ queryKey: ['hubData', projectId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['projectOverview', projectId] });
  }
}
