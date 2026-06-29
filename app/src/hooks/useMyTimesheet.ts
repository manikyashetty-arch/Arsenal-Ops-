/**
 * React Query hooks for the dev Review-and-Submit timesheet flow.
 *
 * - useMyTimesheetQuery: GET the current week's grouped entries. Suspends
 *   the modal's Review view; refetched after Submit so the new "Synced"
 *   badges show up immediately.
 * - useSubmitTimesheetMutation: POST the inline submit. Invalidates the
 *   timesheet query and the home-page capacity card on success so both
 *   reflect the new sync state.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyTimesheet, submitMyTimesheet } from '@/api/timesheet';
import type { MyTimesheetResponse, SubmitTimesheetResponse } from '@/client';

const MY_TIMESHEET_KEY = ['myTimesheet'] as const;

export function useMyTimesheetQuery(enabled = true) {
  return useQuery<MyTimesheetResponse>({
    queryKey: MY_TIMESHEET_KEY,
    queryFn: fetchMyTimesheet,
    enabled,
    // The page already has fresh data when the user opens the modal; a
    // background refetch on the modal opening every time would flash
    // the loading state. Keep it cached for the modal session.
    staleTime: 30_000,
  });
}

export function useSubmitTimesheetMutation() {
  const queryClient = useQueryClient();

  return useMutation<SubmitTimesheetResponse>({
    mutationFn: submitMyTimesheet,
    // No optimistic update — the backend computes the success/failure
    // partition server-side, and showing entries as "Submitted" before
    // we know which ones the QB POST rejected would be misleading.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_TIMESHEET_KEY });
      // Capacity card on the home page reads the same time entries —
      // invalidate it so the "Synced" badge surfaces right away.
      queryClient.invalidateQueries({ queryKey: ['myCapacity'] });
    },
  });
}
