import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PulseData, PulseUpdate } from '../../pulseData';
import { Section, Field } from './_layout';
import { TextInput } from './_inputs';

interface PulseUpdatesSectionProps {
  data: PulseData;
  updateUpdate: (i: number, patch: Partial<PulseUpdate>) => void;
  addUpdate: () => void;
  removeUpdate: (i: number) => void;
}

const PulseUpdatesSection: React.FC<PulseUpdatesSectionProps> = ({
  data,
  updateUpdate,
  addUpdate,
  removeUpdate,
}) => (
  <Section
    title="Updates feed"
    subtitle="Recent project updates / milestones / risks (used in Pulse roadmap views)"
  >
    <div className="space-y-3">
      {data.updates.map((u, i) => (
        <div
          key={i}
          className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.015)]"
        >
          <Field label="When" className="col-span-2">
            <TextInput value={u.when} onChange={(v) => updateUpdate(i, { when: v })} />
          </Field>
          <Field label="Author" className="col-span-2">
            <TextInput value={u.author} onChange={(v) => updateUpdate(i, { author: v })} />
          </Field>
          <Field label="Type" className="col-span-2">
            <select
              value={u.type}
              onChange={(e) => updateUpdate(i, { type: e.target.value as any })}
              className="w-full h-10 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] text-white text-sm px-2"
            >
              <option value="note">note</option>
              <option value="milestone">milestone</option>
              <option value="risk">risk</option>
            </select>
          </Field>
          <Field label="Text" className="col-span-5">
            <Textarea
              value={u.text}
              onChange={(e) => updateUpdate(i, { text: e.target.value })}
              className="bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white min-h-[40px]"
            />
          </Field>
          <div className="col-span-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeUpdate(i)}
              className="text-[#737373] hover:text-[#EF4444]"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={addUpdate}
        className="text-[#a3a3a3] hover:text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add update
      </Button>
    </div>
  </Section>
);

export default PulseUpdatesSection;
