export interface UkBankHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  nation: 'england-wales' | 'scotland' | 'northern-ireland';
}

// Minimal static list for upcoming years — can be expanded or wired to GOV.UK API later.
export const UK_BANK_HOLIDAYS_2026: UkBankHoliday[] = [
  { date: '2026-01-01', name: 'New Year’s Day', nation: 'england-wales' },
  { date: '2026-04-03', name: 'Good Friday', nation: 'england-wales' },
  { date: '2026-04-06', name: 'Easter Monday', nation: 'england-wales' },
  { date: '2026-05-04', name: 'Early May Bank Holiday', nation: 'england-wales' },
  { date: '2026-05-25', name: 'Spring Bank Holiday', nation: 'england-wales' },
  { date: '2026-08-31', name: 'Summer Bank Holiday', nation: 'england-wales' },
  { date: '2026-12-25', name: 'Christmas Day', nation: 'england-wales' },
  { date: '2026-12-28', name: 'Boxing Day (substitute day)', nation: 'england-wales' },
];

// Helper: quick lookup by date string.
export function isUkBankHoliday(dateIso: string): UkBankHoliday | undefined {
  const d = dateIso.slice(0, 10);
  return UK_BANK_HOLIDAYS_2026.find((h) => h.date === d);
}

