import { Resend } from 'resend';

export interface OwnerWelcomeEmailPayload {
  to: string;
  contactName: string;
  companyName: string;
  loginUrl: string;
  temporaryPassword: string;
  trialEndsAt: string;
}

function formatTrialEnd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Sends welcome + login details via Resend.
 * Set RESEND_API_KEY and EMAIL_FROM (verified domain), e.g. CleanFlow <noreply@yourdomain.com>
 */
export async function sendOwnerWelcomeEmail(payload: OwnerWelcomeEmailPayload): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey) {
    console.warn('[ownerWelcomeEmail] RESEND_API_KEY not set — skipping send');
    return { ok: false, error: 'Email not configured (RESEND_API_KEY)' };
  }
  if (!from) {
    console.warn('[ownerWelcomeEmail] EMAIL_FROM not set — skipping send');
    return { ok: false, error: 'Email not configured (EMAIL_FROM)' };
  }

  const resend = new Resend(apiKey);
  const trialEnd = formatTrialEnd(payload.trialEndsAt);
  const firstName = payload.contactName.split(/\s+/)[0] || payload.contactName;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Welcome to <strong>CleanFlow</strong> — your <strong>beta</strong> access for <strong>${escapeHtml(payload.companyName)}</strong> is ready.</p>
  <p>You may see an initial access period ending on <strong>${escapeHtml(trialEnd)}</strong> (this can look like a 14-day trial in the system). <strong>During beta that doesn’t cut you off</strong> — we’ll <strong>extend your access</strong> so you can keep testing until we’re ready to launch.</p>
  <p>When we <strong>officially launch</strong>, we’ll set a <strong>fresh 14-day trial</strong> for your team and send you a <strong>permanent 30% discount code</strong> as a thank-you for beta testing.</p>
  <p>We’d really value your <strong>honest feedback</strong> — what works, what’s confusing, what you’d like changed — so we can improve before launch.</p>
  <p>Sign in with the details below, then change your password from your account settings when you can.</p>
  <table style="margin: 20px 0; padding: 16px; background: #f1f5f9; border-radius: 12px; width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Login page</td></tr>
    <tr><td style="padding: 4px 0;"><a href="${escapeHtml(payload.loginUrl)}" style="color: #059669; font-weight: 600;">${escapeHtml(payload.loginUrl)}</a></td></tr>
    <tr><td style="padding: 12px 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Email</td></tr>
    <tr><td style="padding: 4px 0; font-family: ui-monospace, monospace;">${escapeHtml(payload.to)}</td></tr>
    <tr><td style="padding: 12px 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">Temporary password</td></tr>
    <tr><td style="padding: 4px 0; font-family: ui-monospace, monospace; font-size: 16px; font-weight: 700;">${escapeHtml(payload.temporaryPassword)}</td></tr>
  </table>
  <p style="font-size: 14px; color: #64748b;">If you didn’t request this account, you can ignore this email.</p>
  <p style="margin-top: 24px;">— The CleanFlow team</p>
</body>
</html>`.trim();

  const text = [
    `Hi ${firstName},`,
    '',
    `Welcome to CleanFlow — your beta access for "${payload.companyName}" is ready.`,
    '',
    `You may see an initial access period ending on ${trialEnd} (it can look like a 14-day trial in the system). During beta that doesn't cut you off — we'll extend your access so you can keep testing until we launch.`,
    '',
    `When we officially launch, we'll set a fresh 14-day trial for your team and send you a permanent 30% discount code as a thank-you for beta testing.`,
    '',
    `We'd really value your honest feedback — what works, what's confusing, what you'd like changed — so we can improve before launch.`,
    '',
    `Login: ${payload.loginUrl}`,
    `Email: ${payload.to}`,
    `Temporary password: ${payload.temporaryPassword}`,
    '',
    'Please change your password after signing in.',
    '',
    '— CleanFlow',
  ].join('\n');

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [payload.to],
      subject: `Welcome to CleanFlow beta — your login details (${payload.companyName})`,
      html,
      text,
    });

    if (error) {
      console.error('[ownerWelcomeEmail] Resend error:', error);
      return { ok: false, error: error.message || 'Resend send failed' };
    }
    console.log('[ownerWelcomeEmail] Sent to', payload.to, data?.id ?? '');
    return { ok: true };
  } catch (e: any) {
    console.error('[ownerWelcomeEmail] Exception:', e);
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
