import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { PulseData } from '../../pulseData';
import { Section, Field } from './_layout';
import { NumberInput, TextInput } from './_inputs';

interface PulseSummarySectionProps {
  data: PulseData;
  update: (next: PulseData) => void;
}

const PulseSummarySection: React.FC<PulseSummarySectionProps> = ({ data, update }) => (
  <Section
    title="Pulse summary"
    subtitle="Health score and delivery numbers shown in the hero and tiles"
  >
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <Field label="Health score (0–100)">
        <NumberInput
          value={data.summary.healthScore}
          onChange={(n) => update({ ...data, summary: { ...data.summary, healthScore: n } })}
        />
      </Field>
      <Field label="Health status">
        <select
          value={data.summary.healthStatus}
          onChange={(e) =>
            update({
              ...data,
              summary: { ...data.summary, healthStatus: e.target.value as any },
            })
          }
          className="w-full h-10 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] text-white text-sm px-3"
        >
          <option value="Healthy">Healthy</option>
          <option value="At Risk">At Risk</option>
          <option value="Critical">Critical</option>
        </select>
      </Field>
      <Field label="Delivery %">
        <NumberInput
          value={data.summary.deliveryPct}
          onChange={(n) => update({ ...data, summary: { ...data.summary, deliveryPct: n } })}
        />
      </Field>
      <Field label="Delivery completed">
        <NumberInput
          value={data.summary.deliveryCompleted}
          onChange={(n) => update({ ...data, summary: { ...data.summary, deliveryCompleted: n } })}
        />
      </Field>
      <Field label="Delivery total">
        <NumberInput
          value={data.summary.deliveryTotal}
          onChange={(n) => update({ ...data, summary: { ...data.summary, deliveryTotal: n } })}
        />
      </Field>
      <Field label="Overdue">
        <NumberInput
          value={data.summary.overdueCount}
          onChange={(n) => update({ ...data, summary: { ...data.summary, overdueCount: n } })}
        />
      </Field>
      <Field label="Open bugs">
        <NumberInput
          value={data.summary.openBugs}
          onChange={(n) => update({ ...data, summary: { ...data.summary, openBugs: n } })}
        />
      </Field>
      <Field label="Critical open">
        <NumberInput
          value={data.summary.criticalOpen}
          onChange={(n) => update({ ...data, summary: { ...data.summary, criticalOpen: n } })}
        />
      </Field>
      <Field label="Overall completion %">
        <NumberInput
          value={data.summary.overallCompletion}
          onChange={(n) => update({ ...data, summary: { ...data.summary, overallCompletion: n } })}
        />
      </Field>
      <Field label="Total work items">
        <NumberInput
          value={data.summary.workItems}
          onChange={(n) => update({ ...data, summary: { ...data.summary, workItems: n } })}
        />
      </Field>
      <Field label="Points completed">
        <NumberInput
          value={data.summary.pointsCompleted}
          onChange={(n) => update({ ...data, summary: { ...data.summary, pointsCompleted: n } })}
        />
      </Field>
      <Field label="Points total">
        <NumberInput
          value={data.summary.pointsTotal}
          onChange={(n) => update({ ...data, summary: { ...data.summary, pointsTotal: n } })}
        />
      </Field>
      <Field label="Active sprints">
        <NumberInput
          value={data.summary.activeSprints}
          onChange={(n) => update({ ...data, summary: { ...data.summary, activeSprints: n } })}
        />
      </Field>
      <Field label="Month label">
        <TextInput
          value={data.summary.monthLabel}
          onChange={(v) => update({ ...data, summary: { ...data.summary, monthLabel: v } })}
          placeholder="April 2026"
        />
      </Field>
      <Field label="Month index">
        <NumberInput
          value={data.summary.monthIndex}
          onChange={(n) => update({ ...data, summary: { ...data.summary, monthIndex: n } })}
        />
      </Field>
      <Field label="Total months">
        <NumberInput
          value={data.summary.totalMonths}
          onChange={(n) => update({ ...data, summary: { ...data.summary, totalMonths: n } })}
        />
      </Field>
      <Field label="% of current month tracked">
        <NumberInput
          value={data.currentMonthTrackedPct}
          onChange={(n) => update({ ...data, currentMonthTrackedPct: Math.max(0, Math.min(100, n)) })}
        />
      </Field>
    </div>

    {/* Editorial fields used in the hero + status tiles */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
      <Field label="Risks tile note (e.g. 'All clear')">
        <TextInput
          value={data.summary.risksTrendNote ?? ''}
          onChange={(v) => update({ ...data, summary: { ...data.summary, risksTrendNote: v } })}
          placeholder="All clear"
        />
      </Field>
      <Field label="People tile note (e.g. '6 active contributors')">
        <TextInput
          value={data.summary.peopleTrendNote ?? ''}
          onChange={(v) => update({ ...data, summary: { ...data.summary, peopleTrendNote: v } })}
          placeholder="6 active contributors"
        />
      </Field>
    </div>
    <div className="pt-2">
      <Field label="Hero narrative paragraph">
        <Textarea
          value={data.summary.narrative ?? ''}
          onChange={(e) =>
            update({ ...data, summary: { ...data.summary, narrative: e.target.value } })
          }
          placeholder="One paragraph describing the month's progress, blockers, and outlook. Shows under the hero headline."
          className="bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white min-h-[90px]"
        />
      </Field>
    </div>
  </Section>
);

export default PulseSummarySection;
