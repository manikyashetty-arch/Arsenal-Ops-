import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PulseData, IncludedServicesRow } from '../../pulseData';
import { Section } from './_layout';

interface PulseServicesSectionProps {
  data: PulseData;
  updateIncluded: (i: number, patch: Partial<IncludedServicesRow>) => void;
  addIncluded: () => void;
  removeIncluded: (i: number) => void;
}

const PulseServicesSection: React.FC<PulseServicesSectionProps> = ({
  data,
  updateIncluded,
  addIncluded,
  removeIncluded,
}) => (
  <Section
    title="Billing & included services"
    subtitle="One row per month. The Pulse hero picks the row whose month matches the current Month label (falling back to the latest row)."
  >
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[#737373]">
          <tr>
            <th className="text-left p-1">Month</th>
            <th className="p-1">Total hrs</th>
            <th className="p-1">Used hrs</th>
            <th className="p-1">Accrued hrs</th>
            <th className="p-1">Accrued $</th>
            <th className="p-1">Invoiced hrs</th>
            <th className="p-1">Invoices</th>
            <th className="p-1">Remaining hrs</th>
            <th className="p-1"></th>
          </tr>
        </thead>
        <tbody>
          {data.includedServices.map((r, i) => (
            <tr key={i} className="border-t border-[rgba(255,255,255,0.04)]">
              <td className="p-1">
                <Input
                  value={r.month}
                  onChange={(e) => updateIncluded(i, { month: e.target.value })}
                  placeholder="April 2026"
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-32"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.totalHours}
                  onChange={(e) =>
                    updateIncluded(i, { totalHours: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.usedHours}
                  onChange={(e) =>
                    updateIncluded(i, { usedHours: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.billableAccrued}
                  onChange={(e) =>
                    updateIncluded(i, { billableAccrued: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.billableAccruedCost}
                  onChange={(e) =>
                    updateIncluded(i, { billableAccruedCost: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-24"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.billableInvoiced}
                  onChange={(e) =>
                    updateIncluded(i, { billableInvoiced: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.invoiceCount}
                  onChange={(e) =>
                    updateIncluded(i, { invoiceCount: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-16"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={r.expectedRemaining}
                  onChange={(e) =>
                    updateIncluded(i, { expectedRemaining: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIncluded(i)}
                  className="h-7 w-7 text-[#737373] hover:text-[#EF4444]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={addIncluded}
      className="text-[#a3a3a3] hover:text-white"
    >
      <Plus className="w-4 h-4 mr-2" />
      Add month
    </Button>
  </Section>
);

export default PulseServicesSection;
