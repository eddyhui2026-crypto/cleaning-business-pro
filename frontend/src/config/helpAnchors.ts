/** IDs must match `id` on sections in AdminHelpPage (deep links from other screens). */
export const HelpAnchor = {
  Overview: 'overview',
  GettingStarted: 'getting-started',
  DashboardHome: 'dashboard',
  Staff: 'staff',
  Schedule: 'schedule',
  Jobs: 'jobs',
  RecurringJobs: 'recurring-jobs',
  Bookings: 'bookings',
  Services: 'services',
  Customers: 'customers',
  Invoices: 'invoices',
  Quotes: 'quotes',
  Payroll: 'payroll',
  Reports: 'reports',
  Settings: 'settings',
  Billing: 'billing',
  PublicBooking: 'public-booking',
  Troubleshooting: 'troubleshooting',
} as const;

export type HelpAnchorId = (typeof HelpAnchor)[keyof typeof HelpAnchor];
