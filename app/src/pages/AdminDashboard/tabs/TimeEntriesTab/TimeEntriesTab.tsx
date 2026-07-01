import { useQuery } from '@tanstack/react-query';
import { Clock, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TimeEntriesResponse } from '@/client';
import { formatLocalDate } from '@/components/ProjectsPage/utils';
import { apiFetch } from '@/lib/api';
import TimeEntriesFilterBar from './TimeEntriesFilterBar';
import TimeEntriesSummary from './TimeEntriesSummary';
import TimeEntriesTable from './TimeEntriesTable';
import { resolveDateRange } from './types';
import type { BreakdownRow, EmployeeDayRow, EmployeeOption, FiltersState, ProjectOption } from './types';
import type { WorkforceStatus } from '../../types';

/**
 * Admin Time Entries tab — one row per (employee, day) showing total hours,
 * expandable to the per-project/client split that makes up that total.
 *
 * Three filters compose with AND:
 *   - Date range (preset chips: Today / This week / This month / Last week / Last month / Custom)
 *   - Project (single-select from the admin projects list)
 *   - Employee (single-select from the admin employees list)
 *
 * Backend: GET /api/admin/time-entries (capability admin.time_entries).
 */

interface TimeEntriesTabProps {
  projects: ProjectOption[];
  employees: EmployeeOption[];
}

const TimeEntriesTab: React.FC<TimeEntriesTabProps> = ({ projects, employees }) => {
  const [filters, setFilters] = useState<FiltersState>({
    projectId: null,
    developerId: null,
    preset: 'this_week',
    customFrom: '',
    customTo: '',
  });

  // Which (employee, day) rows are expanded to show their breakdown. Rows
  // start collapsed; cleared on reset so stale keys can't linger.
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Sorted project + employee lists (alphabetical, locale-aware). Recomputed
  // only when the source arrays change — admin tabs share these queries with
  // sibling tabs so the references are already stable.
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [projects],
  );
  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [employees],
  );

  // Resolve the date range every render — cheap, and ties the URL query
  // string to the current filters without a state-mirroring effect.
  const { from, to } = useMemo(
    () => resolveDateRange(filters.preset, filters.customFrom, filters.customTo),
    [filters.preset, filters.customFrom, filters.customTo],
  );

  // Build a stable URL query string so the react-query key is stable across
  // renders. Empty params are omitted so the cache key matches whether the
  // filter is "all employees" or no filter at all.
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.projectId != null) params.set('project_id', String(filters.projectId));
    if (filters.developerId != null) params.set('developer_id', String(filters.developerId));
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [filters.projectId, filters.developerId, from, to]);

  const entriesQuery = useQuery<TimeEntriesResponse>({
    queryKey: ['admin', 'time-entries', filters.projectId, filters.developerId, from, to],
    queryFn: () => apiFetch<TimeEntriesResponse>(`/api/admin/time-entries${queryString}`),
    // Match the cadence other admin tabs use: refetch on focus but no
    // aggressive polling — time entries don't change often enough to warrant it.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Workforce / QuickBooks sync status — only used to display the last-sync
  // timestamp on the header. Shares the cache key with the Integrations tab
  // so switching tabs is free; we don't care if it's stale (UI just reads
  // `last_sync_at`). The header hides itself when not connected.
  const workforceStatusQuery = useQuery<WorkforceStatus>({
    queryKey: ['admin', 'workforceStatus'],
    queryFn: () => apiFetch<WorkforceStatus>('/api/admin/workforce/status'),
    staleTime: 60_000,
  });
  const workforce = workforceStatusQuery.data;
  const lastSyncLabel = useMemo(() => {
    if (!workforce?.connected || !workforce.integration?.last_sync_at) return null;
    try {
      // Render in US Eastern with EST/EDT suffix — matches the Integrations
      // tab's formatTimestamp so the two screens read the same way.
      return new Date(workforce.integration.last_sync_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
        timeZoneName: 'short',
      });
    } catch {
      return workforce.integration.last_sync_at;
    }
  }, [workforce]);

  // Stabilize the empty-default reference — `?? []` produces a fresh array
  // every render, which would re-trigger the aggregation memo below.
  const rows = useMemo(() => entriesQuery.data?.rows ?? [], [entriesQuery.data?.rows]);
  const totalHours = entriesQuery.data?.total_hours ?? 0;
  // Pre-aggregation raw row count from the server (used for the truncation notice).
  const totalRawRows = entriesQuery.data?.total_rows ?? 0;
  const truncated = entriesQuery.data?.truncated ?? false;

  // Aggregate into one row per (employee, local-day) carrying the day's total
  // hours, plus a `breakdown` collapsed by project (with its billing client)
  // that sums back to that total. Rows sort newest-day-first, then employee.
  const employeeDayRows = useMemo<EmployeeDayRow[]>(() => {
    const dayEmp = new Map<string, EmployeeDayRow>();
    // Global index of breakdown rows keyed by `${dayEmpKey}|${projPart}` so a
    // project's lines fold together within each employee-day.
    const breakdownByKey = new Map<string, BreakdownRow>();

    for (const row of rows) {
      const d = new Date(row.logged_at);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = formatLocalDate(d);
      const empPart =
        row.developer_id != null ? `e${row.developer_id}` : `n${row.developer_name ?? ''}`;
      const deKey = `${dayKey}|${empPart}`;

      let de = dayEmp.get(deKey);
      if (!de) {
        de = {
          key: deKey,
          dayKey,
          logged_at: row.logged_at,
          developer_name: row.developer_name,
          hours: 0,
          breakdown: [],
        };
        dayEmp.set(deKey, de);
      }
      de.hours += row.hours || 0;
      // Keep the latest raw timestamp so the date cell reflects the most
      // recent action in the bucket (cosmetic near a day boundary).
      if (new Date(row.logged_at).getTime() > new Date(de.logged_at).getTime()) {
        de.logged_at = row.logged_at;
      }

      const projPart = row.project_id != null ? `p${row.project_id}` : `n${row.project_name ?? ''}`;
      const brKey = `${deKey}|${projPart}`;
      let br = breakdownByKey.get(brKey);
      if (!br) {
        br = {
          key: brKey,
          project_name: row.project_name,
          client_name: row.client_name,
          hours: 0,
        };
        breakdownByKey.set(brKey, br);
        de.breakdown.push(br);
      }
      br.hours += row.hours || 0;
    }

    const out = [...dayEmp.values()];
    for (const de of out) {
      de.breakdown.sort((a, b) => b.hours - a.hours);
    }
    return out.sort((a, b) => {
      // dayKey is YYYY-MM-DD, so lexicographic comparison is correct.
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
      const ea = (a.developer_name ?? '').toLowerCase();
      const eb = (b.developer_name ?? '').toLowerCase();
      return ea < eb ? -1 : ea > eb ? 1 : 0;
    });
  }, [rows]);

  // Reset button activates when any non-default field is set. Keep this in
  // lockstep with `resetFilters` below.
  const hasAnyFilter =
    filters.projectId != null ||
    filters.developerId != null ||
    filters.preset !== 'this_week' ||
    filters.customFrom !== '' ||
    filters.customTo !== '';

  const resetFilters = () => {
    setFilters({
      projectId: null,
      developerId: null,
      preset: 'this_week',
      customFrom: '',
      customTo: '',
    });
    setExpandedRows(new Set());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#E0B954]" />
            Time Entries
          </h2>
          <p className="text-xs text-[#737373] mt-1">
            Audit every hour logged across projects. Filter by project, employee, or date range.
          </p>
        </div>
        {lastSyncLabel && (
          <div
            className="inline-flex items-center gap-1.5 text-[11px] text-[#737373] shrink-0"
            title="Last successful sync of logged hours to QuickBooks. Manage from Admin → Integrations."
          >
            <RefreshCw className="w-3 h-3" />
            Last QuickBooks sync: <span className="text-[#a3a3a3]">{lastSyncLabel}</span>
          </div>
        )}
      </div>

      <TimeEntriesFilterBar
        filters={filters}
        setFilters={setFilters}
        sortedProjects={sortedProjects}
        sortedEmployees={sortedEmployees}
        hasAnyFilter={hasAnyFilter}
        onReset={resetFilters}
      />

      <TimeEntriesSummary
        totalHours={totalHours}
        entriesCount={employeeDayRows.length}
        totalRawRows={totalRawRows}
        truncated={truncated}
        from={from}
        to={to}
      />

      <TimeEntriesTable
        isLoading={entriesQuery.isLoading}
        isError={entriesQuery.isError}
        rows={employeeDayRows}
        expandedRows={expandedRows}
        onToggleRow={toggleRow}
      />
    </div>
  );
};

export default TimeEntriesTab;
