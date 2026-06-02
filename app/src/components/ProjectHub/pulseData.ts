export type LedgerOwner = 'AAI' | 'Client';

export interface LedgerRow {
  category: string;
  amount: number;
  owner: LedgerOwner;
  note?: string;
  included?: boolean;
  tbd?: boolean;
  negative?: boolean;
}

export interface MonthRow {
  m: string;
  devFC: number;
  devAct: number | null;
  dev: number;
  ad: number;
  gtm: number;
  ba: number;
  mgmt: number;
  actual?: boolean;
  partial?: boolean;
}

/** One row of included-service / billing data, scoped to a single month.
 *  The Pulse hero picks the row matching `summary.monthLabel` (falling back
 *  to the last row in the list). Add a new row each month as you log billing. */
export interface IncludedServicesRow {
  month: string; // e.g. "April 2026" — match against summary.monthLabel
  totalHours: number; // contracted included hours total
  usedHours: number; // hours used through this month (cumulative)
  billableAccrued: number; // billable hours accrued past included
  billableAccruedCost: number;
  billableInvoiced: number;
  invoiceCount: number;
  expectedRemaining: number; // forecasted billable hours remaining through contract end
}

/** Backwards-compat alias — old code referred to a single snapshot. */
export type IncludedServices = IncludedServicesRow;

export interface PulseRisk {
  severity: 'high' | 'medium' | 'low';
  title: string;
  owner: string;
  due: string;
  note?: string;
}

export interface PulseMilestone {
  id: string;
  phase: string;
  date: string;
  status: 'done' | 'in-progress' | 'upcoming';
  budget: number;
  spent: number;
  pct: number;
}

export interface PulseUpdate {
  when: string;
  author: string;
  type: 'milestone' | 'note' | 'risk';
  text: string;
}

export interface FeatureForecastRow {
  feature: string;
  employee: string;
  fc: number;
  act: number;
}

export interface ForecastVsActuals {
  current: FeatureForecastRow[]; // Current month MTD
  last: FeatureForecastRow[]; // Last month
  project: FeatureForecastRow[]; // Entire project
}

export interface PulseProjectMeta {
  name: string;
  keyPrefix: string;
  contractStart: string;
  launchTarget: string;
  contractEnd: string;
}

export interface PulseSummary {
  healthScore: number;
  healthStatus: 'Healthy' | 'At Risk' | 'Critical';
  deliveryPct: number;
  deliveryCompleted: number;
  deliveryTotal: number;
  overdueCount: number;
  openBugs: number;
  criticalOpen: number;
  overallCompletion: number;
  workItems: number;
  pointsCompleted: number;
  pointsTotal: number;
  activeSprints: number;
  monthLabel: string;
  monthIndex: number;
  totalMonths: number;
  /** Editorial narrative paragraph shown under the hero headline. */
  narrative: string;
  /** Risks-tile trend text (e.g. "All clear"). */
  risksTrendNote: string;
  /** People-tile trend text (e.g. "6 active contributors"). */
  peopleTrendNote: string;
}

export interface PulseData {
  project: PulseProjectMeta;
  ledger: LedgerRow[];
  months: MonthRow[];
  lastActualIdx: number;
  /** Percent of the current (in-month) period elapsed for the "X% of month tracked" pill. */
  currentMonthTrackedPct: number;
  /** Per-month billing snapshots. Append a new row each month. */
  includedServices: IncludedServicesRow[];
  summary: PulseSummary;
  risks: PulseRisk[];
  milestones: PulseMilestone[];
  updates: PulseUpdate[];
  forecastVsActuals: ForecastVsActuals;
}

/** Pick the right billing row for the current month — matches by month string,
 *  falls back to the last row in the list, and finally to a zeroed default. */
export const currentIncludedServices = (data: PulseData): IncludedServicesRow => {
  const list = data.includedServices ?? [];
  const monthMatch = list.find((r) => r.month === data.summary.monthLabel);
  if (monthMatch) return monthMatch;
  if (list.length > 0) return list[list.length - 1];
  return {
    month: data.summary.monthLabel || '',
    totalHours: 0,
    usedHours: 0,
    billableAccrued: 0,
    billableAccruedCost: 0,
    billableInvoiced: 0,
    invoiceCount: 0,
    expectedRemaining: 0,
  };
};

const STORAGE_PREFIX = 'pulse-data:';

/**
 * Structurally-valid PulseData with every metric zeroed and every list empty.
 * Returned for new projects that have no saved pulse data yet — replaces the
 * old behavior of seeding new projects with the DUMMY_PULSE_DATA fixture.
 *
 * Also used as the default-merge target so older saved payloads pick up
 * newly-added schema fields as zeros rather than as demo values.
 */
export const buildEmptyPulseData = (): PulseData => ({
  project: { name: '', keyPrefix: '', contractStart: '', launchTarget: '', contractEnd: '' },
  ledger: [],
  months: [],
  lastActualIdx: -1,
  currentMonthTrackedPct: 0,
  includedServices: [],
  summary: {
    healthScore: 0,
    healthStatus: 'Healthy',
    deliveryPct: 0,
    deliveryCompleted: 0,
    deliveryTotal: 0,
    overdueCount: 0,
    openBugs: 0,
    criticalOpen: 0,
    overallCompletion: 0,
    workItems: 0,
    pointsCompleted: 0,
    pointsTotal: 0,
    activeSprints: 0,
    monthLabel: '',
    monthIndex: 0,
    totalMonths: 0,
    narrative: '',
    risksTrendNote: '',
    peopleTrendNote: '',
  },
  risks: [],
  milestones: [],
  updates: [],
  forecastVsActuals: { current: [], last: [], project: [] },
});

/**
 * Load pulse data for a project.
 *
 * The fixture (`DUMMY_PULSE_DATA`) is split into a separate chunk via dynamic
 * import so its ~9 KB of JSON literal never ships in the main bundle. We only
 * pay that cost when a project has no saved pulse override AND the user
 * actually opens the Pulse tab.
 *
 * Callers should treat this as async — the first call without a localStorage
 * row will resolve after the fixtures chunk loads. Subsequent calls that hit
 * the cached module are effectively synchronous.
 */
export const loadPulseData = async (projectId: string | number): Promise<PulseData> => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
    if (!raw) {
      const { DUMMY_PULSE_DATA } = await import('./pulseData.fixtures');
      return DUMMY_PULSE_DATA;
    }
    const parsed = JSON.parse(raw);
    const { DUMMY_PULSE_DATA } = await import('./pulseData.fixtures');
    // Migrate legacy includedServices: single object → single-element list.
    let includedServices: IncludedServicesRow[];
    if (Array.isArray(parsed.includedServices)) {
      includedServices = parsed.includedServices;
    } else if (parsed.includedServices && typeof parsed.includedServices === 'object') {
      const old = parsed.includedServices as any;
      includedServices = [
        {
          month: old.throughMonth || DUMMY_PULSE_DATA.summary.monthLabel,
          totalHours: old.totalHours ?? 0,
          usedHours: old.usedHours ?? 0,
          billableAccrued: old.billableAccrued ?? 0,
          billableAccruedCost: old.billableAccruedCost ?? 0,
          billableInvoiced: old.billableInvoiced ?? 0,
          invoiceCount: old.invoiceCount ?? 0,
          expectedRemaining: old.expectedRemaining ?? 0,
        },
      ];
    } else {
      includedServices = DUMMY_PULSE_DATA.includedServices;
    }
    // Deep-merge nested objects so older saved payloads pick up new fields.
    return {
      ...DUMMY_PULSE_DATA,
      ...parsed,
      project: { ...DUMMY_PULSE_DATA.project, ...(parsed.project || {}) },
      summary: { ...DUMMY_PULSE_DATA.summary, ...(parsed.summary || {}) },
      includedServices,
      forecastVsActuals: {
        ...DUMMY_PULSE_DATA.forecastVsActuals,
        ...(parsed.forecastVsActuals || {}),
      },
    };
  } catch {
    const { DUMMY_PULSE_DATA } = await import('./pulseData.fixtures');
    return DUMMY_PULSE_DATA;
  }
};

export const savePulseData = (projectId: string | number, data: PulseData): void => {
  localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(data));
};

export const resetPulseData = (projectId: string | number): void => {
  localStorage.removeItem(STORAGE_PREFIX + projectId);
};

export const computeDerived = (data: PulseData) => {
  const contractTotal = data.ledger
    .filter((l) => !l.included && !l.tbd)
    .reduce((a, b) => a + b.amount, 0);

  const aaiTotal = data.ledger
    .filter((l) => l.owner === 'AAI' && !l.included)
    .reduce((a, b) => a + b.amount, 0);

  const clientTotal = data.ledger
    .filter((l) => l.owner === 'Client' && !l.tbd)
    .reduce((a, b) => a + b.amount, 0);

  const monthsWithCum = (() => {
    let cum = 0;
    return data.months.map((row) => {
      const total = row.dev + row.ad + row.gtm + row.ba + row.mgmt;
      cum += total;
      return { ...row, total, cum };
    });
  })();

  const burnedToDate = monthsWithCum
    .slice(0, data.lastActualIdx + 1)
    .reduce((a, b) => a + b.total, 0);

  const forecastEnd = monthsWithCum[monthsWithCum.length - 1]?.cum || 0;

  return { contractTotal, aaiTotal, clientTotal, monthsWithCum, burnedToDate, forecastEnd };
};
