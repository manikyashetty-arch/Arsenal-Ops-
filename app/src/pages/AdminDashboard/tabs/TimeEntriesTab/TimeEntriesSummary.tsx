import { AlertTriangle } from 'lucide-react';
import { formatRangeDate } from './types';

interface TimeEntriesSummaryProps {
  totalHours: number;
  /** Post-aggregation row count — matches what the table shows. */
  entriesCount: number;
  /** Pre-aggregation raw count from the server — quoted in the truncation notice. */
  totalRawRows: number;
  truncated: boolean;
  from: string | null;
  to: string | null;
}

/** Totals strip + truncation warning. */
const TimeEntriesSummary: React.FC<TimeEntriesSummaryProps> = ({
  totalHours,
  entriesCount,
  totalRawRows,
  truncated,
  from,
  to,
}) => {
  return (
    <>
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#737373]">Total hours</p>
          <p className="text-2xl font-bold text-white mt-1">{totalHours}h</p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#737373]">Entries</p>
          {/* After-aggregation count so this matches the rows shown below.
              Total hours stays the server's sum (preserved across the collapse). */}
          <p className="text-2xl font-bold text-white mt-1">{entriesCount}</p>
        </div>
        <div className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#737373]">Range</p>
          <p className="text-sm font-medium text-white mt-1">
            {from ? formatRangeDate(from) : '—'} <span className="text-[#525252]">→</span>{' '}
            {to ? formatRangeDate(to) : '—'}
          </p>
        </div>
      </div>

      {/* Truncation warning */}
      {truncated && (
        <div className="rounded-lg border border-[#E0B954]/30 bg-[#E0B954]/10 p-3 flex items-center gap-2 text-xs text-[#E0B954]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Capped at {totalRawRows} raw entries before aggregation. Refine your filters to include
          older data.
        </div>
      )}
    </>
  );
};

export default TimeEntriesSummary;
