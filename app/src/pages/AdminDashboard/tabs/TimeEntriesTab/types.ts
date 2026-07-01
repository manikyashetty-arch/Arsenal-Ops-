// Domain types + pure date helpers for the Time Entries tab.
// Co-located so the orchestrator, filter bar, summary, and table all share one
// definition (CONVENTIONS rule 6). The helpers are pure (date in → string out)
// and called from `useMemo` bodies in the orchestrator.
import { parseLocalDate, formatLocalDate } from '@/components/ProjectsPage/utils';

export interface ProjectOption {
  id: number;
  name: string;
}

export interface EmployeeOption {
  id: number;
  name: string;
  email: string;
}

/**
 * One line in an employee-day's expandable breakdown: how many hours that
 * employee put on a given project (and which client it bills to) that day.
 * Raw entries are collapsed by project within the (employee, day) bucket.
 */
export interface BreakdownRow {
  /** Stable React key — `${dayKey}|emp|proj`. */
  key: string;
  project_name: string | null;
  client_name: string | null;
  hours: number;
}

/**
 * A top-level table row: total hours one employee logged on one local day.
 * Click to expand `breakdown` — the per-project/client split that sums to
 * `hours`.
 */
export interface EmployeeDayRow {
  /** Stable React key + expand-state key — `${dayKey}|emp`. */
  key: string;
  /** Local-time YYYY-MM-DD; drives the descending sort. */
  dayKey: string;
  logged_at: string;
  developer_name: string | null;
  hours: number;
  breakdown: BreakdownRow[];
}

export type DatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_week'
  | 'last_month'
  | 'custom';

export interface FiltersState {
  projectId: number | null;
  developerId: number | null;
  preset: DatePreset;
  // Only consulted when preset === 'custom'.
  customFrom: string;
  customTo: string;
}

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_week', label: 'Last week' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

/**
 * Start-of-week helper. The app's week runs **Saturday → Friday** — matches
 * `backend/services/capacity_service.py:week_boundaries()` and the
 * Employees tab capacity columns. Do not change without changing the
 * backend too, or the filtered range will disagree with the capacity view.
 *
 * JS Date.getDay() returns 0=Sun..6=Sat; we want days-since-most-recent-Sat:
 * Sat=0, Sun=1, Mon=2, … Fri=6 → `(getDay() + 1) % 7`.
 */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysSinceSat = (out.getDay() + 1) % 7;
  out.setDate(out.getDate() - daysSinceSat);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Translate a filter preset to a concrete `from`/`to` ISO date pair the
 * backend understands. Both bounds are inclusive — the backend treats
 * `date_to` as end-of-day. Returns null bounds for "custom + empty input"
 * so the admin can leave one side open (e.g. all entries since a date).
 *
 * Today is read inside this helper — it's called from a `useMemo`, whose
 * body is opt-in non-pure (only runs when deps change), so the
 * react-hooks/purity rule is satisfied.
 */
export function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from: string | null; to: string | null } {
  if (preset === 'custom') {
    return {
      from: customFrom || null,
      to: customTo || null,
    };
  }
  const today = new Date();
  const todayStr = formatLocalDate(today);
  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }
  if (preset === 'this_week') {
    return { from: formatLocalDate(startOfWeek(today)), to: todayStr };
  }
  if (preset === 'last_week') {
    const thisSat = startOfWeek(today);
    const lastSat = addDays(thisSat, -7);
    const lastFri = addDays(thisSat, -1);
    return { from: formatLocalDate(lastSat), to: formatLocalDate(lastFri) };
  }
  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatLocalDate(from), to: todayStr };
  }
  if (preset === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    // Day 0 of the current month is the last day of the previous month.
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatLocalDate(from), to: formatLocalDate(to) };
  }
  return { from: null, to: null };
}

/**
 * Format an ISO timestamp as "Jun 8, 2026" for table display — date only,
 * no time component. Falls back to the raw string on parse error so an
 * upstream data issue doesn't render as "Invalid Date".
 */
export function formatLoggedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a `YYYY-MM-DD` filter date as "Jun 8, 2026" for the Range summary
 * card. Uses `parseLocalDate` rather than `new Date(str)` because plain
 * `new Date("2026-06-08")` parses as UTC and shifts to the previous local
 * day in any timezone west of UTC — the same papercut `parseLocalDate`
 * exists to fix elsewhere in the app.
 */
export function formatRangeDate(yyyyMmDd: string): string {
  const d = parseLocalDate(yyyyMmDd);
  if (!d) return yyyyMmDd;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
