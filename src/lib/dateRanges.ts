import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';

export type DateRangePreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'fy' | 'thisYear' | 'custom' | 'all';

export function getDateRange(preset: DateRangePreset, custom?: { from?: Date; to?: Date }): { from?: Date; to?: Date } {
  const now = new Date();
  switch (preset) {
    case 'thisMonth': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'lastMonth': {
      const d = subMonths(now, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    case 'last3Months': return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case 'thisYear': return { from: startOfYear(now), to: endOfYear(now) };
    case 'fy': {
      // Indian FY: Apr 1 to Mar 31
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: new Date(y, 3, 1), to: new Date(y + 1, 2, 31, 23, 59, 59, 999) };
    }
    case 'custom': return { from: custom?.from, to: custom?.to };
    case 'all':
    default: return {};
  }
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  last3Months: 'Last 3 Months',
  fy: 'Financial Year',
  thisYear: 'This Year',
  custom: 'Custom',
  all: 'All Time'
};
