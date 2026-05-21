/**
 * React-query hooks for the DB-derived Pulse overlay.
 *
 * `useDerivedPulse` fetches `GET /api/projects/{id}/pulse-derived` — a
 * server-computed snapshot of every Pulse-view field we can derive from
 * `work_items`, `time_entries`, `sprints`, `project_milestones`, and
 * `activity_logs`.
 *
 * `useMergedPulse` is the convenience wrapper that callers will use: it pairs
 * the derived query with the manual `PulseData` (still in localStorage today)
 * and returns the merged result. While the derived endpoint is loading or
 * errors, the merged value is exactly the manual data — the Pulse view stays
 * fully functional in the degraded path.
 */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { DerivedPulseData, PulseData, mergePulseData } from './pulseData';

/** React-query key for the derived Pulse endpoint. Prefix-compatible with
 *  `invalidateQueries({ queryKey: ['pulseDerived'] })`. */
const pulseDerivedKey = (projectId: string | number) =>
  ['pulseDerived', String(projectId)] as const;

/**
 * Fetch the server-derived Pulse snapshot for a project.
 *
 * - `staleTime: 60_000` — the data is cheap to recompute but not free; 60s is
 *   enough to absorb tab churn without staleness becoming a problem.
 * - `enabled` only fires when a `projectId` is actually present so we don't
 *   issue a `/api/projects/undefined/pulse-derived` request during route
 *   transitions.
 */
export const useDerivedPulse = (projectId: string | number | null | undefined) =>
  useQuery<DerivedPulseData>({
    queryKey: pulseDerivedKey(projectId ?? ''),
    queryFn: () => apiFetch<DerivedPulseData>(`/api/projects/${projectId}/pulse-derived`),
    staleTime: 60_000,
    enabled: projectId !== null && projectId !== undefined && projectId !== '',
  });

/**
 * Convenience wrapper: pairs `useDerivedPulse` with the caller's manual
 * `PulseData` and returns the merged result.
 *
 * `data` is non-null whenever `manual` is — loading does NOT block the view.
 * When the derived query is loading or has errored, `data === manual`.
 */
export const useMergedPulse = (
  projectId: string | number | null | undefined,
  manual: PulseData | null,
): { data: PulseData | null; isLoading: boolean; isError: boolean } => {
  const derivedQuery = useDerivedPulse(projectId);
  return {
    data: manual ? mergePulseData(manual, derivedQuery.data) : null,
    isLoading: derivedQuery.isLoading,
    isError: derivedQuery.isError,
  };
};
