import { describe, it, expect } from 'vitest';
import { DUMMY_PULSE_DATA } from './pulseData.fixtures';
import {
  buildEmptyPulseData,
  computeDerived,
  currentIncludedServices,
  mergePulseData,
  type DerivedPulseData,
  type PulseData,
} from './pulseData';

// A deep-ish clone so a test that mutates a nested field can't leak into the
// shared fixture (structuredClone is available in the jsdom/Node test runtime).
const fixture = (): PulseData => structuredClone(DUMMY_PULSE_DATA);

describe('currentIncludedServices', () => {
  it('picks the row whose month matches summary.monthLabel', () => {
    const data = fixture(); // summary.monthLabel === 'April 2026'
    const row = currentIncludedServices(data);
    expect(row.month).toBe('April 2026');
    expect(row.usedHours).toBe(1000);
    expect(row.invoiceCount).toBe(2);
  });

  it('falls back to the last row when no month matches', () => {
    const data = fixture();
    data.summary.monthLabel = 'No Such Month 9999';
    const row = currentIncludedServices(data);
    // last row in the fixture list is April 2026
    expect(row.month).toBe('April 2026');
  });

  it('returns a zeroed default when the list is empty', () => {
    const data = fixture();
    data.includedServices = [];
    data.summary.monthLabel = 'May 2026';
    const row = currentIncludedServices(data);
    expect(row).toEqual({
      month: 'May 2026',
      totalHours: 0,
      usedHours: 0,
      billableAccrued: 0,
      billableAccruedCost: 0,
      billableInvoiced: 0,
      invoiceCount: 0,
      expectedRemaining: 0,
    });
  });

  it('zeroed default uses empty-string month when monthLabel is blank', () => {
    const data = buildEmptyPulseData(); // includedServices=[] and monthLabel=''
    expect(currentIncludedServices(data).month).toBe('');
  });
});

describe('buildEmptyPulseData', () => {
  it('produces a structurally-valid, fully-zeroed PulseData', () => {
    const empty = buildEmptyPulseData();
    expect(empty.ledger).toEqual([]);
    expect(empty.months).toEqual([]);
    expect(empty.includedServices).toEqual([]);
    expect(empty.risks).toEqual([]);
    expect(empty.milestones).toEqual([]);
    expect(empty.updates).toEqual([]);
    expect(empty.forecastVsActuals).toEqual({ current: [], last: [], project: [] });
    expect(empty.lastActualIdx).toBe(-1);
    expect(empty.summary.healthScore).toBe(0);
    expect(empty.summary.healthStatus).toBe('Healthy');
  });

  it('is safe to run through computeDerived without throwing', () => {
    const derived = computeDerived(buildEmptyPulseData());
    expect(derived).toEqual({
      contractTotal: 0,
      aaiTotal: 0,
      clientTotal: 0,
      monthsWithCum: [],
      burnedToDate: 0,
      forecastEnd: 0,
    });
  });
});

describe('computeDerived', () => {
  it('sums the contract total excluding included and tbd rows', () => {
    // 210000 + 72000 + 34000 + 48000 - 82500 = 281500 (Product Mgmt is
    // included → excluded; GTM Leadership is tbd → excluded).
    const { contractTotal } = computeDerived(fixture());
    expect(contractTotal).toBe(281500);
  });

  it('sums AAI total excluding included rows only (tbd still counts if AAI)', () => {
    // AAI, not included: 210000 + 72000 + 34000 + (-82500) = 233500.
    // Product Mgmt (AAI, included) is excluded; GTM Leadership is Client.
    const { aaiTotal } = computeDerived(fixture());
    expect(aaiTotal).toBe(233500);
  });

  it('sums Client total excluding tbd rows only', () => {
    // Client, not tbd: Ad Spend 48000. GTM Leadership (Client, tbd) excluded.
    const { clientTotal } = computeDerived(fixture());
    expect(clientTotal).toBe(48000);
  });

  it('computes per-month totals and a running cumulative', () => {
    const { monthsWithCum } = computeDerived(fixture());
    const feb = monthsWithCum[0]!;
    // Feb: dev 30150 + ad 0 + gtm 0 + ba 0 + mgmt 6000 = 36150
    expect(feb.total).toBe(36150);
    expect(feb.cum).toBe(36150);
    const mar = monthsWithCum[1]!;
    // Mar total: 32325 + 7800 = 40125; cum = 36150 + 40125 = 76275
    expect(mar.total).toBe(40125);
    expect(mar.cum).toBe(76275);
    // cum is monotonically non-decreasing and ends at forecastEnd
    expect(monthsWithCum[monthsWithCum.length - 1]!.cum).toBe(
      computeDerived(fixture()).forecastEnd,
    );
  });

  it('burnedToDate sums only through lastActualIdx (inclusive)', () => {
    const data = fixture(); // lastActualIdx === 2 → Feb, Mar, Apr
    const { burnedToDate, monthsWithCum } = computeDerived(data);
    const expected = monthsWithCum[0]!.total + monthsWithCum[1]!.total + monthsWithCum[2]!.total;
    expect(burnedToDate).toBe(expected);
  });

  it('burnedToDate is 0 when lastActualIdx is -1 (no actuals)', () => {
    const data = fixture();
    data.lastActualIdx = -1;
    expect(computeDerived(data).burnedToDate).toBe(0);
  });

  it('forecastEnd is 0 when there are no months', () => {
    const data = fixture();
    data.months = [];
    expect(computeDerived(data).forecastEnd).toBe(0);
  });
});

describe('mergePulseData', () => {
  it('returns manual unchanged when derived is null (loading/error path)', () => {
    const manual = fixture();
    expect(mergePulseData(manual, null)).toBe(manual);
    expect(mergePulseData(manual, undefined)).toBe(manual);
  });

  it('overlays derived summary while preserving editorial narrative + risksTrendNote', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      summary: { healthScore: 55, healthStatus: 'At Risk', deliveryPct: 40 },
    };
    const merged = mergePulseData(manual, derived);
    expect(merged.summary.healthScore).toBe(55);
    expect(merged.summary.healthStatus).toBe('At Risk');
    expect(merged.summary.deliveryPct).toBe(40);
    // narrative + risksTrendNote are editorial → survive from manual
    expect(merged.summary.narrative).toBe(manual.summary.narrative);
    expect(merged.summary.risksTrendNote).toBe(manual.summary.risksTrendNote);
  });

  it('always keeps ledger and risks from manual', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, { summary: { healthScore: 1 } });
    expect(merged.ledger).toBe(manual.ledger);
    expect(merged.risks).toBe(manual.risks);
  });

  it('aligns derived months by label, keeping manual cost categories + devFC', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      months: [{ m: 'Feb 26', devAct: 999, actual: true }],
    };
    const merged = mergePulseData(manual, derived);
    // derived only supplies one month → merged months collapses to it
    expect(merged.months).toHaveLength(1);
    const feb = merged.months[0]!;
    expect(feb.devAct).toBe(999); // from derived
    expect(feb.dev).toBe(30150); // manual cost category preserved
    expect(feb.devFC).toBe(420); // manual forecast preserved
  });

  it('zeroes cost categories for a derived month with no manual counterpart', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      months: [{ m: 'Feb 27', devAct: 12, partial: true }],
    };
    const merged = mergePulseData(manual, derived);
    const row = merged.months[0]!;
    expect(row.m).toBe('Feb 27');
    expect(row.devAct).toBe(12);
    expect(row.partial).toBe(true);
    expect(row.dev).toBe(0);
    expect(row.devFC).toBe(0);
    expect(row.mgmt).toBe(0);
  });

  it('keeps manual months when derived months is an empty array', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, { months: [] });
    expect(merged.months).toBe(manual.months);
  });

  it('aligns derived includedServices by month, preserving manual billing fields', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      includedServices: [{ month: 'March 2026', usedHours: 888 }],
    };
    const merged = mergePulseData(manual, derived);
    expect(merged.includedServices).toHaveLength(1);
    const row = merged.includedServices[0]!;
    expect(row.usedHours).toBe(888); // derived
    expect(row.totalHours).toBe(1000); // manual contract total preserved
    expect(row.invoiceCount).toBe(1); // manual billing preserved
  });

  it('zeroes billing for a derived includedServices row with no manual match', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, {
      includedServices: [{ month: 'Dec 2099', usedHours: 5 }],
    });
    const row = merged.includedServices[0]!;
    expect(row.month).toBe('Dec 2099');
    expect(row.usedHours).toBe(5);
    expect(row.totalHours).toBe(0);
    expect(row.invoiceCount).toBe(0);
  });

  it('aligns derived milestones by id, keeping manual budget/spent/pct', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      milestones: [{ id: 'm1', phase: 'Renamed Phase', date: 'Feb 26', status: 'in-progress' }],
    };
    const merged = mergePulseData(manual, derived);
    expect(merged.milestones).toHaveLength(1);
    const m = merged.milestones[0]!;
    expect(m.phase).toBe('Renamed Phase'); // derived
    expect(m.status).toBe('in-progress'); // derived
    expect(m.budget).toBe(45000); // manual preserved
    expect(m.spent).toBe(43200);
    expect(m.pct).toBe(100);
  });

  it('zeroes budget/spent/pct for a derived milestone with no manual match', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, {
      milestones: [{ id: 'new', phase: 'Unpriced', date: 'Mar 27', status: 'upcoming' }],
    });
    const m = merged.milestones[0]!;
    expect(m.id).toBe('new');
    expect(m.budget).toBe(0);
    expect(m.spent).toBe(0);
    expect(m.pct).toBe(0);
  });

  it('keeps manual milestones when derived milestones is an empty array', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, { milestones: [] });
    expect(merged.milestones).toBe(manual.milestones);
  });

  it('takes lastActualIdx / currentMonthTrackedPct from derived only when numeric', () => {
    const manual = fixture();
    const withNums = mergePulseData(manual, { lastActualIdx: 7, currentMonthTrackedPct: 12 });
    expect(withNums.lastActualIdx).toBe(7);
    expect(withNums.currentMonthTrackedPct).toBe(12);
    // omitted → fall back to manual
    const without = mergePulseData(manual, {});
    expect(without.lastActualIdx).toBe(manual.lastActualIdx);
    expect(without.currentMonthTrackedPct).toBe(manual.currentMonthTrackedPct);
  });

  it('wholesale-replaces updates + forecastVsActuals when derived supplies them', () => {
    const manual = fixture();
    const derived: DerivedPulseData = {
      updates: [{ when: 'now', author: 'DB', type: 'note', text: 'derived update' }],
      forecastVsActuals: { current: [], last: [], project: [] },
    };
    const merged = mergePulseData(manual, derived);
    expect(merged.updates).toEqual(derived.updates);
    expect(merged.forecastVsActuals).toBe(derived.forecastVsActuals);
    // omitted → manual survives
    const keep = mergePulseData(manual, {});
    expect(keep.updates).toBe(manual.updates);
    expect(keep.forecastVsActuals).toBe(manual.forecastVsActuals);
  });

  it('shallow-merges project meta (derived keys win, manual fills the rest)', () => {
    const manual = fixture();
    const merged = mergePulseData(manual, { project: { name: 'Renamed' } });
    expect(merged.project.name).toBe('Renamed');
    expect(merged.project.keyPrefix).toBe(manual.project.keyPrefix);
    expect(merged.project.contractEnd).toBe(manual.project.contractEnd);
  });
});
