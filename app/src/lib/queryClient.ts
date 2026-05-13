/**
 * React Query client configuration.
 *
 * Defaults explained:
 *
 * - ``staleTime: 30s`` — repeated mounts within 30s use cached data without
 *   a network round-trip. This is what makes back-navigation feel instant.
 * - ``refetchOnMount: false`` — when a fresh-enough query is already in
 *   the cache, mounting a component that uses it doesn't fire a refetch.
 *   Combined with staleTime, this kills the "every navigation refetches"
 *   pattern the app had pre-react-query.
 * - ``refetchOnWindowFocus: true`` — refetch when the user tabs back, but
 *   only when the data is actually stale (>30s old). This replaces the
 *   manual ``visibilitychange`` + ``focus`` listeners in ProjectDetail
 *   and ProjectBoard.
 * - ``gcTime: 5min`` — how long unused cache entries stick around. Long
 *   enough to survive a quick out-and-back trip; short enough to bound
 *   memory.
 * - ``retry: 1`` for queries, ``retry: 0`` for mutations — queries are
 *   safe to retry once (transient network blip); mutations are not
 *   (might double-create on the server).
 *
 * Query-key conventions (use these in every useQuery / invalidateQueries):
 *
 *     ['projects']                          full project list
 *     ['project', id]                       single project
 *     ['workItems', filters]                work items, filters is the
 *                                           query-param object
 *     ['workItem', id]                      single work item
 *     ['workItem', id, 'comments']          nested resource of an item
 *     ['developers']                        full developer list
 *     ['personalTasks']                     current user's personal tasks
 *     ['myTasks']                           current user's assigned items
 *     ['sprints', projectId]                project's sprints
 *     ['hubData', projectId]                project's analytics + PRD
 *     ['admin', resource]                   admin-only resources
 *
 * Invalidate on mutation by prefix:
 *
 *     queryClient.invalidateQueries({ queryKey: ['workItems'] })   // all lists
 *     queryClient.invalidateQueries({ queryKey: ['workItem', id] })  // one item
 *     queryClient.invalidateQueries({ queryKey: ['project', id] })  // a project
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
