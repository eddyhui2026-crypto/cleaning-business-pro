/** Round raw hours to nearest interval for payroll. intervalMinutes: 5, 10, 15, or 60. */
export function roundHoursForPayroll(rawHours: number, intervalMinutes: number): number {
  const allowed = [5, 10, 15, 60];
  const minutes = allowed.includes(intervalMinutes) ? intervalMinutes : 15;
  const rounded = Math.round((rawHours * 60) / minutes) * minutes / 60;
  return Math.round(rounded * 100) / 100;
}
