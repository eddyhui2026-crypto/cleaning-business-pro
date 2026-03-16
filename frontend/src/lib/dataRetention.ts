/**
 * Data retention for job photos and business records.
 * - Job photos: 90 days (3 months), in line with UK cleaning apps (e.g. My Cleaning App).
 * - Business records (invoices, job metadata): 6 years for HMRC/ICO.
 * @see https://www.mycleaningapp.com/privacy-policy/ (job photos 3 months)
 * @see https://www.gov.uk/hmrc-internal-manuals/compliance-handbook/ch14100 (records 6 years)
 */
export const PHOTO_RETENTION_DAYS = 90;
export const PHOTO_RETENTION_MONTHS = 3;
export const RECORDS_RETENTION_YEARS = 6;

export const DATA_RETENTION_MESSAGE =
  'Job photos are kept for 3 months (90 days), in line with other UK cleaning apps. Other business records are retained for 6 years for UK tax and legal requirements.';

export const DATA_RETENTION_SHORT = 'Photos are kept for 3 months (90 days).';
export const DATA_RETENTION_REPORT = 'Photos are kept for 3 months (90 days). This report may be retained longer for business records.';
