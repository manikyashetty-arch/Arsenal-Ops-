import { PaletteTicketChip } from '../components/PaletteTicketChip';
import type { PaletteTicket } from '../types';

interface TicketPaletteProps {
  tickets: PaletteTicket[];
  activeTicketId: number | null;
  /** workItemId -> hours scheduled this week (for the capacity bar). */
  scheduledByTicket: Record<number, number>;
  onChipPointerDown: (ticket: PaletteTicket, e: React.PointerEvent) => void;
  onSelectTicket: (ticket: PaletteTicket) => void;
}

/** Left rail listing the user's assigned tickets — the drag source for blocks. */
export function TicketPalette({
  tickets,
  activeTicketId,
  scheduledByTicket,
  onChipPointerDown,
  onSelectTicket,
}: TicketPaletteProps) {
  return (
    <div className="w-[272px] flex-none border-r border-white/[0.08] flex flex-col min-h-0">
      <div className="px-3.5 pt-3.5 pb-2.5 flex-none flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[#f5f5f5]">My Tickets</div>
        <div className="text-[10px] text-[#737373] bg-white/5 px-2 py-px rounded-full">
          {tickets.length} assigned
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-[11px] pb-3.5 flex flex-col gap-2">
        {tickets.length === 0 ? (
          <div className="text-[11px] text-[#555] px-1 py-6 text-center leading-relaxed">
            No assigned tickets. Tickets assigned to you appear here to drag onto the calendar.
          </div>
        ) : (
          tickets.map((t) => (
            <PaletteTicketChip
              key={t.workItemId}
              ticket={t}
              active={activeTicketId === t.workItemId}
              scheduledHours={scheduledByTicket[t.workItemId] ?? 0}
              onPointerDown={(e) => onChipPointerDown(t, e)}
              onSelect={() => onSelectTicket(t)}
            />
          ))
        )}
      </div>
      <div className="flex-none px-3.5 py-2.5 border-t border-white/[0.06] text-[10px] text-[#555] leading-snug">
        Drag a ticket onto the grid, or select one and draw on the calendar. The bar shows hours
        scheduled this week vs remaining.
      </div>
    </div>
  );
}
