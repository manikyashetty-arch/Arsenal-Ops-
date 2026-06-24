import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GRID,
  blockToInterval,
  formatClock,
  formatDuration,
  formatHours,
  intervalToBlock,
  snapHour,
  startOfWeekMonday,
  weekDays,
} from './calendar';

describe('snapHour', () => {
  it('snaps to the nearest 15-minute increment', () => {
    expect(snapHour(9.1, DEFAULT_GRID)).toBe(9);
    expect(snapHour(9.2, DEFAULT_GRID)).toBe(9.25);
    expect(snapHour(9.13, DEFAULT_GRID)).toBe(9.25);
  });

  it('clamps to the visible window', () => {
    expect(snapHour(2, DEFAULT_GRID)).toBe(DEFAULT_GRID.startHour);
    expect(snapHour(23, DEFAULT_GRID)).toBe(DEFAULT_GRID.endHour);
  });

  it('honors a 30-minute step', () => {
    const cfg = { ...DEFAULT_GRID, stepMinutes: 30 };
    expect(snapHour(9.4, cfg)).toBe(9.5);
    expect(snapHour(9.2, cfg)).toBe(9);
  });
});

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(1.5)).toBe('1h 30m');
    expect(formatDuration(2)).toBe('2h');
    expect(formatDuration(0.25)).toBe('15m');
  });

  it('formats fractional hours without trailing zeros', () => {
    expect(formatHours(3.5)).toBe('3.5h');
    expect(formatHours(3)).toBe('3h');
    expect(formatHours(0.25)).toBe('0.25h');
  });

  it('formats a 12-hour clock', () => {
    expect(formatClock(9)).toBe('9 AM');
    expect(formatClock(9.5)).toBe('9:30 AM');
    expect(formatClock(13.25)).toBe('1:15 PM');
    expect(formatClock(12)).toBe('12 PM');
  });
});

describe('week dates', () => {
  it('finds Monday for any weekday', () => {
    // 2026-06-24 is a Wednesday.
    const monday = startOfWeekMonday(new Date(2026, 5, 24, 15, 30));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(22);
    expect(monday.getHours()).toBe(0);
  });

  it('renders five weekday columns', () => {
    const days = weekDays(startOfWeekMonday(new Date(2026, 5, 24)));
    expect(days.map((d) => d.name)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(days.map((d) => d.date)).toEqual(['22', '23', '24', '25', '26']);
  });
});

describe('block <-> interval conversion round-trips', () => {
  it('preserves day and time through a round trip', () => {
    const weekStart = startOfWeekMonday(new Date(2026, 5, 24));
    const { startISO, endISO } = blockToInterval(weekStart, 2, 9.5, 11.25);
    const back = intervalToBlock(weekStart, startISO, endISO);
    expect(back.dayIdx).toBe(2);
    expect(back.start).toBe(9.5);
    expect(back.end).toBe(11.25);
  });

  it('produces UTC ISO strings', () => {
    const weekStart = startOfWeekMonday(new Date(2026, 5, 24));
    const { startISO } = blockToInterval(weekStart, 0, 9, 10);
    expect(startISO).toMatch(/Z$/);
  });
});
