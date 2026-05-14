import React from 'react';
import { PulseData } from '../../pulseData';
import { Section, Field } from './_layout';
import { TextInput } from './_inputs';

interface PulseProjectMetaSectionProps {
  data: PulseData;
  update: (next: PulseData) => void;
}

const PulseProjectMetaSection: React.FC<PulseProjectMetaSectionProps> = ({ data, update }) => (
  <Section title="Project metadata" subtitle="Display name, contract span, launch target">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      <Field label="Project name">
        <TextInput
          value={data.project.name}
          onChange={(v) => update({ ...data, project: { ...data.project, name: v } })}
        />
      </Field>
      <Field label="Key prefix">
        <TextInput
          value={data.project.keyPrefix}
          onChange={(v) => update({ ...data, project: { ...data.project, keyPrefix: v } })}
        />
      </Field>
      <Field label="Contract start">
        <TextInput
          value={data.project.contractStart}
          onChange={(v) => update({ ...data, project: { ...data.project, contractStart: v } })}
          placeholder="e.g. Feb 2026"
        />
      </Field>
      <Field label="Launch target">
        <TextInput
          value={data.project.launchTarget}
          onChange={(v) => update({ ...data, project: { ...data.project, launchTarget: v } })}
          placeholder="e.g. Sep 2026"
        />
      </Field>
      <Field label="Contract end">
        <TextInput
          value={data.project.contractEnd}
          onChange={(v) => update({ ...data, project: { ...data.project, contractEnd: v } })}
          placeholder="e.g. Jan 2027"
        />
      </Field>
    </div>
  </Section>
);

export default PulseProjectMetaSection;
