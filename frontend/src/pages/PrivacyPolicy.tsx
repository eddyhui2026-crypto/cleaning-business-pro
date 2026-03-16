import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Privacy Policy</h1>
            <p className="mt-1 text-xs text-slate-400">
              How CleanFlow handles your company, staff, and customer data.
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
            <h2 className="text-sm font-semibold text-slate-50">1. Who we are</h2>
            <p className="mt-2 text-slate-300/90">
              CleanFlow is a software tool for cleaning businesses. We process data as a processor on
              behalf of our customer companies. Your cleaning company remains the data controller for
              staff and customer information stored in the app.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">2. What data we collect</h2>
            <p className="mt-2">
              When you use CleanFlow, we store the minimum information needed to run your cleaning
              operations:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300/90">
              <li>Company account details such as contact name, email address, and company name.</li>
              <li>
                Staff profiles including name, phone number, role, and time and attendance records
                created through the staff app.
              </li>
              <li>
                Customer records including name, address, contact details, visit history, job notes, and
                invoices you create in the system.
              </li>
              <li>
                Job information including addresses, scheduled times, assigned staff, notes, and job
                photos where you choose to upload them.
              </li>
              <li>
                Account and security information such as login email, password hashes, and audit logs of
                important actions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">3. How we use this data</h2>
            <p className="mt-2">
              We use the data you store in CleanFlow solely to provide the service to your company and
              improve the product. Typical uses include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300/90">
              <li>Showing schedules, job lists, and reports to your admin team and staff.</li>
              <li>Generating invoices, quotes, and job reports for your customers.</li>
              <li>
                Sending service emails such as login links, password reset codes, and important account
                notifications.
              </li>
              <li>Detecting abuse, fixing bugs, and improving performance and reliability.</li>
            </ul>
            <p className="mt-2">
              We do not sell your data and we do not contact your customers for marketing on our own
              behalf.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">4. Where your data is stored</h2>
            <p className="mt-2">
              CleanFlow is built on Supabase (PostgreSQL database and storage). Data is stored in secure
              cloud infrastructure with access controls. Access to production data is limited to
              authorised personnel for support and maintenance purposes.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">5. Data retention</h2>
            <p className="mt-2">
              Job photos are automatically removed from the system after approximately 90 days. This keeps
              evidence available for a reasonable period while avoiding unnecessary long term storage.
            </p>
            <p className="mt-2">
              Operational records such as jobs, invoices, and payments may be kept longer by your company
              to meet UK accounting and tax requirements (typically up to 6 years). Your company controls
              how long to keep these records and when to delete them.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">6. Your rights</h2>
            <p className="mt-2">
              If you are a staff member or customer of a cleaning company that uses CleanFlow, you should
              contact that company directly to exercise your data protection rights (for example, access,
              correction, or deletion). We will support our customer companies in responding to those
              requests.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">7. Contact</h2>
            <p className="mt-2">
              For questions about this privacy policy or how CleanFlow handles data, please contact us at{' '}
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

