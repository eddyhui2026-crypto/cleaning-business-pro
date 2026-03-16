import { Link } from 'react-router-dom';

export function DataAndCookiesPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Data & Cookies</h1>
            <p className="mt-1 text-xs text-slate-400">
              How CleanFlow uses cookies and how long we keep different types of data.
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
            <h2 className="text-sm font-semibold text-slate-50">1. Cookies we use</h2>
            <p className="mt-2">
              CleanFlow mainly uses cookies and similar storage to keep you signed in and to remember basic
              preferences. We do not use third-party advertising cookies.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300/90">
              <li>
                <span className="font-semibold">Authentication cookies</span> to keep admin, staff, and
                customer users signed in securely.
              </li>
              <li>
                <span className="font-semibold">Preference cookies</span> for small UI choices such as
                filters or last-selected views.
              </li>
              <li>
                <span className="font-semibold">Essential session storage</span> used by the app to load
                data and protect against abuse.
              </li>
            </ul>
            <p className="mt-2">
              Because these cookies are strictly necessary for the service to function, the app may not
              work correctly if you block them.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">2. Job photos and media</h2>
            <p className="mt-2">
              Job photos are stored in Supabase Storage and linked to your jobs. To balance evidence and
              privacy, we automatically remove job photo links from the system after approximately 90 days,
              and attempt to delete the underlying files from storage.
            </p>
            <p className="mt-2">
              This keeps a short history for quality checks and disputes, while avoiding keeping large
              volumes of images for years.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">3. Business and financial records</h2>
            <p className="mt-2">
              Your cleaning company may need to keep business records such as jobs, invoices, and payments
              for up to 6 years under UK tax and accounting rules. CleanFlow does not automatically delete
              these records, so that you can keep a complete history for your accountant and HMRC if
              required.
            </p>
            <p className="mt-2">
              As the data controller, your company decides how long to keep each type of record and when to
              export or delete older data.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">4. Analytics</h2>
            <p className="mt-2">
              If we add simple usage analytics in future, it will be to understand which features are used
              most and to improve the product. We will avoid collecting more personal data than necessary
              and will update this page if our use of analytics changes in a material way.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-50">5. Contact</h2>
            <p className="mt-2">
              If you have any questions about cookies, data retention, or how CleanFlow handles data for
              your business, please contact{' '}
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

