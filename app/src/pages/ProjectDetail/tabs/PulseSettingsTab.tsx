import { PulseSettingsView } from '@/components/ProjectHub';
import { PulseData, PulseMilestone } from '@/components/ProjectHub/pulseData';
import { PulseOverridesUser } from '@/components/ProjectHub/usePulseData';

interface PulseSettingsTabProps {
  projectId: string;
  pulseData: PulseData;
  /** Milestones merged with the derive endpoint — the editor renders one
   *  financial row per derived milestone so PMs can attach budgets to the
   *  authoritative project_milestones list. */
  derivedMilestones: PulseMilestone[];
  updatedAt: string | null;
  updatedBy: PulseOverridesUser | null;
  onSave: (data: PulseData) => Promise<void>;
  onReset: (fixture: PulseData) => Promise<void>;
}

const PulseSettingsTab = ({
  projectId,
  pulseData,
  derivedMilestones,
  updatedAt,
  updatedBy,
  onSave,
  onReset,
}: PulseSettingsTabProps) => {
  return (
    <PulseSettingsView
      projectId={projectId}
      initial={pulseData}
      derivedMilestones={derivedMilestones}
      updatedAt={updatedAt}
      updatedBy={updatedBy}
      onSave={onSave}
      onReset={onReset}
    />
  );
};

export default PulseSettingsTab;
