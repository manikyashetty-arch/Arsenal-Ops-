import type { BreakdownRow } from './types';

/**
 * One line in an employee-day's expanded breakdown — how many hours went to a
 * given project (and the client it bills to). Rendered inside the nested
 * breakdown table when a top-level (employee, day) row is expanded.
 */
const EntryRow: React.FC<{ row: BreakdownRow }> = ({ row }) => (
  <tr>
    <td className="px-3 py-1.5 text-[#d4d4d4]">
      {row.project_name ?? <span className="text-[#737373] italic">—</span>}
    </td>
    <td className="px-3 py-1.5 text-[#a3a3a3]">
      {row.client_name ?? <span className="text-[#737373] italic">—</span>}
    </td>
    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[#E0B954]">{row.hours}h</td>
  </tr>
);

export default EntryRow;
