/**
 * Typed API client for the dev Review-and-Submit timesheet endpoints.
 *
 * Backend:
 *   GET  /api/developers/me/timesheet         → MyTimesheetResponse
 *   POST /api/developers/me/timesheet/submit  → SubmitTimesheetResponse
 *
 * The response types are generated from the backend's OpenAPI schema
 * (see app/CLAUDE.md "API types"). Run `npm run gen:api` after any
 * backend schema change to keep them in sync.
 */
import type { MyTimesheetResponse, SubmitTimesheetResponse } from '@/client';
import { apiFetch } from '@/lib/api';

/** Fetch the current developer's Mon-Fri timesheet, grouped by QB client → project. */
export function fetchMyTimesheet(): Promise<MyTimesheetResponse> {
  return apiFetch<MyTimesheetResponse>('/api/developers/me/timesheet');
}

/**
 * Submit the developer's eligible entries inline and sync them to QuickBooks.
 *
 * Per-entry failures come back in `response.failed[]` — they are NOT thrown.
 * Operational failures (no QB connection / 503, in-flight sync / 409, no
 * Developer / 404) come back as a thrown ApiError from apiFetch.
 */
export function submitMyTimesheet(): Promise<SubmitTimesheetResponse> {
  return apiFetch<SubmitTimesheetResponse>('/api/developers/me/timesheet/submit', {
    method: 'POST',
  });
}
