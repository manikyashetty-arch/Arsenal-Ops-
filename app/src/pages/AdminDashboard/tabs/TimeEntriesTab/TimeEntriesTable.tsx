import { Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { Fragment } from 'react';
import EntryRow from './EntryRow';
import { formatLoggedAt } from './types';
import type { EmployeeDayRow } from './types';

interface TimeEntriesTableProps {
  isLoading: boolean;
  isError: boolean;
  /** One row per (employee, day). */
  rows: EmployeeDayRow[];
  /** Keys of the (employee, day) rows currently expanded. */
  expandedRows: Set<string>;
  onToggleRow: (key: string) => void;
}

/** Date · Employee · Hours table. Each row expands to the per-project/client
 *  breakdown that sums to that day's hours for that employee. */
const TimeEntriesTable: React.FC<TimeEntriesTableProps> = ({
  isLoading,
  isError,
  rows,
  expandedRows,
  onToggleRow,
}) => {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-[#E0B954] border-t-transparent rounded-full" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">Failed to load time entries.</div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center">
          <Clock className="w-8 h-8 text-[#525252] mx-auto mb-2" />
          <p className="text-sm text-[#737373]">No time entries match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgba(255,255,255,0.02)]">
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#737373]">
                <th className="px-4 py-2.5 font-medium w-8" aria-label="Expand" />
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {rows.map((row) => {
                const isExpanded = expandedRows.has(row.key);
                return (
                  <Fragment key={row.key}>
                    <tr
                      className="hover:bg-[rgba(255,255,255,0.025)] cursor-pointer"
                      onClick={() => onToggleRow(row.key)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} breakdown for ${
                        row.developer_name ?? 'employee'
                      } on ${formatLoggedAt(row.logged_at)}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onToggleRow(row.key);
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-[#737373]">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#a3a3a3] whitespace-nowrap">
                        {formatLoggedAt(row.logged_at)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {row.developer_name ?? <span className="text-[#737373] italic">deleted</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{row.hours}h</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[rgba(255,255,255,0.015)]">
                        <td colSpan={4} className="px-4 pb-3 pl-12">
                          {/* Per-project/client split that sums to the row's hours. */}
                          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-[rgba(255,255,255,0.02)]">
                                <tr className="text-left text-[10px] uppercase tracking-wider text-[#737373]">
                                  <th className="px-3 py-1.5 font-medium">Project</th>
                                  <th className="px-3 py-1.5 font-medium">Client</th>
                                  <th className="px-3 py-1.5 font-medium text-right">Hours</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                                {row.breakdown.map((b) => (
                                  <EntryRow key={b.key} row={b} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TimeEntriesTable;
