import { Link } from 'react-router-dom';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Terms of Service</h1>
            <p className="mt-1 text-xs text-slate-400">
              The basic rules for using the CleanFlow app.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-emerald-400/70 hover:text-emerald-200"
          >
            Back to homepage
          </Link>
        </header>

        <div className="space-y-8 text-sm text-slate-200/90">
          <section>
            <h2 className="text-sm font-semibold text-slate-50">1. Using CleanFlow</h2>
            <p className="mt-2">
              CleanFlow is provided as a subscription service to cleaning businesses. When you create an
              account, you are responsible for:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300/90">
              <li>Keeping your login details and passwords confidential.</li>
              <li>Ensuring that only authorised staff have access to your company account.</li>
              <li>Making sure data you enter (for example, staff and customer details) is accurate.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">2. Your responsibilities</h2>
            <p className="mt-2">
              You agree to use CleanFlow in line with applicable laws, including data protection and
              employment rules in your country. In particular, you are responsible for:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300/90">
              <li>Getting any consent required from staff and customers before storing their data.</li>
              <li>Configuring your payroll and rates correctly before you rely on them to pay staff.</li>
              <li>Reviewing reports and exports before submitting them to tax or other authorities.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">3. Service availability</h2>
            <p className="mt-2">
              We aim to keep CleanFlow available at all times, but we may occasionally need to perform
              maintenance or updates. We will take reasonable steps to minimise disruption and to protect
              your data during maintenance windows.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">4. Payments and subscription</h2>
            <p className="mt-2">
              Access to CleanFlow is billed as a subscription. Pricing and plan limits are shown on our
              website and in the app. Subscriptions renew automatically until cancelled. You can cancel
              future renewals at any time from your billing settings; your access will continue until the
              end of the current billing period.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">5. Data ownership</h2>
            <p className="mt-2">
              You retain ownership of all business data you store in CleanFlow, including customer details,
              jobs, and financial records. We act as a processor for that data so that you can run your
              cleaning operations. You are responsible for exporting and retaining any records you need for
              your own accounting and compliance.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">6. Limitation of liability</h2>
            <p className="mt-2">
              CleanFlow is provided &ldquo;as is&rdquo;. We work hard to keep the service reliable, but we
              cannot guarantee that it will be free from errors at all times. To the extent permitted by
              law, we are not liable for indirect or consequential losses such as lost profits, missed
              jobs, or penalties that result from how you use (or do not use) the app.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">7. Changes to these terms</h2>
            <p className="mt-2">
              We may update these terms from time to time, for example when we add new features. If there
              are material changes, we will notify the account owner by email or through the app. Continuing
              to use CleanFlow after the change takes effect means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">8. Contact</h2>
            <p className="mt-2">
              If you have questions about these terms or how they apply to your business, please contact us
              at{' '}
              <a href="mailto:support@cleanflow.app" className="text-emerald-300 hover:text-emerald-200">
                support@cleanflow.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

