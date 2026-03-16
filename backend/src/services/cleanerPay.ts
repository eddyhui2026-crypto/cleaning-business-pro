import { supabase } from '../lib/supabaseClient';

type PayType = 'hourly' | 'percentage' | 'fixed';

function resolvePay(
  job: any,
  profile: any,
  company: any
): { payType: PayType; rate: number; pct: number; fixed: number } {
  const jobType = job?.pay_type;
  const profileType = profile?.pay_type;
  const companyType = company?.default_pay_type ?? 'hourly';

  const payType: PayType =
    jobType && ['hourly', 'percentage', 'fixed'].includes(jobType)
      ? jobType
      : profileType && ['hourly', 'percentage', 'fixed'].includes(profileType)
        ? profileType
        : companyType in { hourly: 1, percentage: 1, fixed: 1 }
          ? (companyType as PayType)
          : 'hourly';

  const rate =
    payType === 'hourly'
      ? (job?.pay_hourly_rate != null ? Number(job.pay_hourly_rate) : profile?.pay_hourly_rate != null ? Number(profile.pay_hourly_rate) : Number(company?.default_hourly_rate)) || 0
      : 0;
  const pct =
    payType === 'percentage'
      ? (job?.pay_percentage != null ? Number(job.pay_percentage) : profile?.pay_percentage != null ? Number(profile.pay_percentage) : Number(company?.default_pay_percentage)) || 0
      : 0;
  const fixed =
    payType === 'fixed'
      ? (job?.pay_fixed_amount != null ? Number(job.pay_fixed_amount) : profile?.pay_fixed_amount != null ? Number(profile.pay_fixed_amount) : Number(company?.default_fixed_pay)) || 0
      : 0;

  return { payType, rate, pct, fixed };
}

/**
 * Compute and save cleaner_pay for all clocked_out attendances of a job.
 * Resolution per staff: job pay settings > that staff's profile pay settings > company default.
 * Hourly: each staff gets total_hours * their resolved rate. Percentage/Fixed: if from job, split; if from staff, each gets their own.
 */
export async function calculateCleanerPayForJob(jobId: string, companyId: string): Promise<{ updated: number }> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, price, pay_type, pay_hourly_rate, pay_percentage, pay_fixed_amount')
    .eq('id', jobId)
    .eq('company_id', companyId)
    .single();
  if (jobErr || !job) return { updated: 0 };

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('default_pay_type, default_hourly_rate, default_pay_percentage, default_fixed_pay')
    .eq('id', companyId)
    .maybeSingle();
  if (companyErr) return { updated: 0 };

  const jobPrice = Math.max(0, parseFloat(String((job as any).price ?? 0)) || 0);

  const { data: attendances, error: attErr } = await supabase
    .from('staff_attendance')
    .select('id, staff_id, total_hours')
    .eq('job_id', jobId)
    .eq('status', 'clocked_out')
    .not('total_hours', 'is', null);

  if (attErr || !attendances?.length) return { updated: 0 };

  const staffIds = [...new Set((attendances as any[]).map((a: any) => a.staff_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, pay_type, pay_hourly_rate, pay_percentage, pay_fixed_amount')
    .in('id', staffIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  let updated = 0;
  const n = attendances.length;

  for (const a of attendances) {
    const staffId = (a as any).staff_id;
    const profile = profileMap.get(staffId);
    const { payType, rate, pct, fixed } = resolvePay(job, profile, company);

    let pay = 0;
    if (payType === 'hourly') {
      const hours = Math.max(0, Number((a as any).total_hours) || 0);
      pay = Math.round(hours * rate * 100) / 100;
    } else if (payType === 'percentage') {
      if ((job as any).pay_type === 'percentage' && (job as any).pay_percentage != null) {
        const totalPay = Math.round((jobPrice * (job as any).pay_percentage / 100) * 100) / 100;
        pay = n > 0 ? Math.round((totalPay / n) * 100) / 100 : 0;
      } else {
        pay = Math.round((jobPrice * pct / 100) * 100) / 100;
      }
    } else {
      if ((job as any).pay_type === 'fixed' && (job as any).pay_fixed_amount != null) {
        const totalFixed = Number((job as any).pay_fixed_amount);
        pay = n > 0 ? Math.round((totalFixed / n) * 100) / 100 : 0;
      } else {
        pay = Math.round(fixed * 100) / 100;
      }
    }

    const { error: uErr } = await supabase
      .from('staff_attendance')
      .update({ cleaner_pay: pay })
      .eq('id', (a as any).id);
    if (!uErr) updated++;
  }

  return { updated };
}
