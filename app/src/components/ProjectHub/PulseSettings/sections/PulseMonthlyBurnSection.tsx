import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PulseData, MonthRow } from '../../pulseData';
import { Section, Field } from './_layout';

interface PulseMonthlyBurnSectionProps {
  data: PulseData;
  updateMonth: (i: number, patch: Partial<MonthRow>) => void;
  addMonth: () => void;
  removeMonth: (i: number) => void;
  updateLastActualIdx: (idx: number) => void;
}

const PulseMonthlyBurnSection: React.FC<PulseMonthlyBurnSectionProps> = ({
  data,
  updateMonth,
  addMonth,
  removeMonth,
  updateLastActualIdx,
}) => (
  <Section
    title="Monthly burn"
    subtitle="Per-month forecast & actuals (dollars by category and dev hours)"
  >
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-[#737373]">
          <tr>
            <th className="text-left p-1">Month</th>
            <th className="p-1">Dev FC hrs</th>
            <th className="p-1">Dev Act hrs</th>
            <th className="p-1">Dev $</th>
            <th className="p-1">BA $</th>
            <th className="p-1">Mgmt $</th>
            <th className="p-1">Ad $</th>
            <th className="p-1">GTM $</th>
            <th className="p-1">Actual</th>
            <th className="p-1">MTD</th>
            <th className="p-1"></th>
          </tr>
        </thead>
        <tbody>
          {data.months.map((m, i) => (
            <tr key={i} className="border-t border-[rgba(255,255,255,0.04)]">
              <td className="p-1">
                <Input
                  value={m.m}
                  onChange={(e) => updateMonth(i, { m: e.target.value })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.devFC}
                  onChange={(e) => updateMonth(i, { devFC: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.devAct ?? ''}
                  onChange={(e) =>
                    updateMonth(i, {
                      devAct: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.dev}
                  onChange={(e) => updateMonth(i, { dev: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-24"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.ba}
                  onChange={(e) => updateMonth(i, { ba: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.mgmt}
                  onChange={(e) => updateMonth(i, { mgmt: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.ad}
                  onChange={(e) => updateMonth(i, { ad: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1">
                <Input
                  type="number"
                  value={m.gtm}
                  onChange={(e) => updateMonth(i, { gtm: parseFloat(e.target.value) || 0 })}
                  className="h-8 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white text-xs w-20"
                />
              </td>
              <td className="p-1 text-center">
                <input
                  type="checkbox"
                  checked={!!m.actual}
                  onChange={(e) => updateMonth(i, { actual: e.target.checked })}
                />
              </td>
              <td className="p-1 text-center">
                <input
                  type="checkbox"
                  checked={!!m.partial}
                  onChange={(e) => updateMonth(i, { partial: e.target.checked })}
                />
              </td>
              <td className="p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMonth(i)}
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
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <Field label="Last actual month index (0-based)">
        <Input
          type="number"
          value={data.lastActualIdx}
          onChange={(e) => updateLastActualIdx(parseInt(e.target.value) || 0)}
          className="bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white w-32"
        />
      </Field>
      <Button
        variant="ghost"
        size="sm"
        onClick={addMonth}
        className="text-[#a3a3a3] hover:text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add month
      </Button>
    </div>
  </Section>
);

export default PulseMonthlyBurnSection;
