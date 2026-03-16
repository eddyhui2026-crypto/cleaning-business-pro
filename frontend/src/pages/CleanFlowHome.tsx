import { ArrowRight, CheckCircle2, Star, Quote, Users, Clock, CreditCard, BarChart3, CalendarRange, Calendar } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const CUSTOMER_LOGIN_URL = '/customer-login';
const COMPANY_LOGIN_URL = '/login';
const TRIAL_URL = '/signup';

export function CleanFlowHome() {
  const [testimonialPage, setTestimonialPage] = useState(0);

  const testimonials = [
    {
      quote: 'CleanFlow replaced 3 different tools for us. Scheduling and invoicing are now effortless.',
      name: 'Amelia Jones',
      company: 'BrightSpark Cleaning Co.',
    },
    {
      quote: 'We finally have one place for bookings, staff, and payments. The team picked it up in a day.',
      name: 'Michael Patel',
      company: 'Spotless Homes',
    },
    {
      quote: 'Our customers love the online booking, and I love seeing the whole day on one clean dashboard.',
      name: 'Sarah Green',
      company: 'Green & Tidy Services',
    },
    {
      quote: 'The staff app means my cleaners always know where to be and when. Fewer calls, fewer no‑shows.',
      name: 'James O’Neill',
      company: 'CityShine Cleaning',
    },
    {
      quote: 'We used to chase paper timesheets. Now payroll takes 15 minutes and everyone gets paid correctly.',
      name: 'Lisa Ahmed',
      company: 'FreshStart Domestic',
    },
    {
      quote: 'I like that online booking is there when we’re ready, but most of our work still comes from regulars.',
      name: 'Tom Riley',
      company: 'Riley & Co Cleaning',
    },
  ];

  const totalTestimonialPages = Math.ceil(testimonials.length / 3);
  const visibleTestimonials = testimonials.slice(testimonialPage * 3, testimonialPage * 3 + 3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#1d4ed8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#22c55e_0,_transparent_55%)] opacity-70" />

      {/* NAVBAR */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-400 to-indigo-500 shadow-lg shadow-emerald-500/30">
              <span className="text-sm font-black tracking-tight text-slate-950">CF</span>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight">CleanFlow</span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
                Cleaning Ops OS
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-200 md:flex">
            <a href="#features" className="hover:text-emerald-300 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-emerald-300 transition-colors">
              Pricing
            </a>
            <a href="#how-it-works" className="hover:text-emerald-300 transition-colors">
              How It Works
            </a>
            <a href="#testimonials" className="hover:text-emerald-300 transition-colors">
              Testimonials
            </a>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href={CUSTOMER_LOGIN_URL}
              className="rounded-full px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-300"
            >
              Customer Login
            </a>
            <a
              href={COMPANY_LOGIN_URL}
              className="rounded-full px-3 py-2 text-xs font-semibold text-slate-200 hover:text-emerald-300"
            >
              Company Login
            </a>
            <a
              href={TRIAL_URL}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-300"
            >
              Start Free Trial
              <ArrowRight size={14} />
            </a>
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              href={COMPANY_LOGIN_URL}
              className="rounded-full px-3 py-2 text-[11px] font-semibold text-slate-200 border border-white/10"
            >
              Login
            </a>
            <a
              href={TRIAL_URL}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-950"
            >
              Try Free
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* HERO */}
        <section className="grid gap-12 py-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-20 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Built for cleaning companies
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-50 sm:text-4xl lg:text-5xl">
              Run Your Cleaning Business
              <span className="block text-emerald-300">Without the Chaos</span>
            </h1>
            <p className="max-w-xl text-sm text-slate-200/80 sm:text-base">
              Scheduling, staff timesheets, invoices, and client CRM — all in one simple platform designed
              for growing cleaning teams.
            </p>

            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 border border-amber-300/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
              <span>Launch offer · 50% off forever</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={TRIAL_URL}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-xs font-black uppercase tracking-[0.25em] text-slate-950 shadow-xl shadow-emerald-500/40 hover:bg-emerald-300"
              >
                Start Free Trial
                <ArrowRight size={16} />
              </a>
              <a
                href={COMPANY_LOGIN_URL}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-slate-50 hover:border-emerald-300/60"
              >
                Book Demo
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs text-slate-300/80">
              <div className="flex items-center gap-2">
                <Star size={14} className="text-amber-300" />
                <span className="font-semibold">
                  Trusted by cleaning teams across the UK
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-300" />
                <span>14‑day free trial · No credit card</span>
              </div>
            </div>
          </div>

          {/* Product mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-emerald-400/10 via-indigo-500/10 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 shadow-[0_24px_80px_rgba(15,23,42,0.9)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold">Today · Schedule</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <CalendarRange size={14} />
                  <span>Drag & drop jobs</span>
                </div>
              </div>
              <div className="grid gap-0 border-b border-white/5 bg-slate-950/40 px-4 py-3 text-[11px] text-slate-200/90 md:grid-cols-[1.2fr,1fr]">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Upcoming jobs
                  </p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-50">
                          10:00 · Flat Deep Clean
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Taylor · SW1A 1AA
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Assigned
                      </span>
                    </li>
                    <li className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-50">
                          13:30 · Office Clean
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Ahmed · EC2A 3LT
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Pending
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="mt-4 space-y-2 border-t border-white/5 pt-3 md:mt-0 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    Today at a glance
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
                      <p className="text-slate-400">Revenue</p>
                      <p className="text-sm font-bold text-emerald-300">£1,240</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
                      <p className="text-slate-400">Jobs</p>
                      <p className="text-sm font-bold text-slate-50">7 scheduled</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
                      <p className="text-slate-400">Staff on shift</p>
                      <p className="text-sm font-bold text-slate-50">5</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
                      <p className="text-slate-400">Outstanding invoices</p>
                      <p className="text-sm font-bold text-amber-300">£680</p>
                    </div>
                  </div>
                </div>
              </div>
            <div className="flex items-center justify-between px-4 py-3 text-[10px] text-slate-400">
              <span>CleanFlow demo screenshot</span>
              <span>Connects to your existing operations app</span>
            </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="space-y-8 py-12 md:py-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Features
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
                Everything your cleaning business runs on
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
                CleanFlow connects to your existing operations tools so your team can work in one place
                while you attract and convert more customers.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<Calendar className="h-5 w-5 text-emerald-300" />}
              title="Smart Job Scheduling"
              description="See your whole week on a drag‑and‑drop calendar. Move jobs in seconds, avoid double‑booking, and keep travel routes tight so your team wastes less time on the road."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5 text-fuchsia-300" />}
              title="Staff App & Timesheets"
              description="Each cleaner gets a simple mobile view of today’s jobs, with clock in/out and notes. Timesheets update automatically so you always know who is on shift and for how long."
            />
            <FeatureCard
              icon={<CreditCard className="h-5 w-5 text-amber-300" />}
              title="Invoices & Payments"
              description="Turn finished jobs into invoices in a couple of clicks. Mark cash or bank transfer payments, see who still owes you money, and download clean PDF invoices and receipts."
            />
            <FeatureCard
              icon={<Users className="h-5 w-5 text-sky-300" />}
              title="Client CRM"
              description="Store every customer’s details, door codes, notes, and visit history in one place. New staff can turn up to a job and instantly see what matters without you explaining again."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5 text-lime-300" />}
              title="Reports & Payroll"
              description="Daily, weekly and monthly views show revenue, completed jobs, and staff hours. Export the numbers you need so payroll takes minutes instead of evenings with a calculator."
            />
            <FeatureCard
              icon={<Clock className="h-5 w-5 text-indigo-300" />}
              title="Online Booking (optional)"
              description="When you’re ready, give regular customers a simple page to request cleans 24/7. Requests drop straight into your schedule, but you stay in control of what you accept."
            />
          </div>
        </section>

        {/* WORKFLOW */}
        <section id="how-it-works" className="space-y-8 py-12 md:py-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Workflow
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
                How CleanFlow fits your day
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300/80">
                Use CleanFlow as the front door and command centre for your existing web app. Customers
                book online, your team works from the app, and you get paid faster.
              </p>
            </div>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            <WorkflowStep
              step="1"
              title="Add Clients"
              description="Create and manage your customer database. Import clients or add them as they book online."
            />
            <WorkflowStep
              step="2"
              title="Schedule Jobs"
              description="Assign jobs to staff, manage recurring cleans, and keep everyone in sync with your existing app."
            />
            <WorkflowStep
              step="3"
              title="Get Paid Faster"
              description="Generate invoices, send them in a click, and keep track of what’s been paid."
            />
          </ol>
        </section>

        {/* PRICING */}
        <section id="pricing" className="space-y-8 py-12 md:py-16">
          <div className="text-center space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Pricing
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
              Simple plans by team size
            </h2>
            <p className="mt-2 text-sm text-slate-300/80">
              Every plan includes all features: scheduling, CRM, staff app, GPS check‑ins, online booking,
              invoices, PDF reports, and data retention.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 border border-amber-300/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
              <span>Launch offer · 50% off forever with EARLYBIRD50</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <PricingCard
              name="Small teams (1–10 staff)"
              price="£9.90"
              description="For solo cleaners and small teams getting organised. All features included."
              highlights={[
                'Drag‑and‑drop job scheduling calendar',
                'Staff app with clock in/out & timesheets',
                'Real‑time staff status and GPS check‑ins',
                'Automatic invoices from completed jobs',
                'Track who has paid and who still owes',
                'Client CRM with notes & visit history',
                'Cash / bank transfer payment tracking',
                'Daily, weekly and monthly performance reports',
                'Customer portal for invoices and receipts',
                'Job photos stored for 90 days (evidence)',
                'Up to 10 staff accounts · unlimited jobs & customers',
              ]}
            />
            <PricingCard
              name="Growing teams (11–20 staff)"
              price="£19.90"
              description="For growing companies running daily routes with multiple teams. All features included."
              popular
              highlights={[
                'Drag‑and‑drop job scheduling calendar',
                'Staff app with clock in/out & timesheets',
                'Real‑time staff status and GPS check‑ins',
                'Automatic invoices from completed jobs',
                'Track who has paid and who still owes',
                'Client CRM with notes & visit history',
                'Cash / bank transfer payment tracking',
                'Daily, weekly and monthly performance reports',
                'Customer portal for invoices and receipts',
                'Job photos stored for 90 days (evidence)',
                'Up to 20 staff accounts · unlimited jobs & customers',
              ]}
            />
            <PricingCard
              name="Established teams (21–30 staff)"
              price="£29.90"
              description="For established cleaning businesses that need full visibility. All features included."
              highlights={[
                'Drag‑and‑drop job scheduling calendar',
                'Staff app with clock in/out & timesheets',
                'Real‑time staff status and GPS check‑ins',
                'Automatic invoices from completed jobs',
                'Track who has paid and who still owes',
                'Client CRM with notes & visit history',
                'Cash / bank transfer payment tracking',
                'Daily, weekly and monthly performance reports',
                'Customer portal for invoices and receipts',
                'Job photos stored for 90 days (evidence)',
                'Up to 30 staff accounts · unlimited jobs & customers',
              ]}
            />
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Use code <span className="font-semibold text-emerald-300">EARLYBIRD50</span> at checkout in the
            first 3 months after launch to get <span className="font-semibold">50% off forever</span>.
          </p>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="space-y-8 py-12 md:py-16">
          <div className="flex items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Testimonials
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-50 md:text-3xl">
                Loved by cleaning company owners
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setTestimonialPage((prev) => (prev - 1 + totalTestimonialPages) % totalTestimonialPages)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 hover:border-emerald-300/60"
              >
                <span className="sr-only">Previous</span>
                <span className="text-lg leading-none">{'‹'}</span>
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalTestimonialPages }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 w-1.5 rounded-full ${
                      idx === testimonialPage ? 'bg-emerald-300' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTestimonialPage((prev) => (prev + 1) % totalTestimonialPages)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 hover:border-emerald-300/60"
              >
                <span className="sr-only">Next</span>
                <span className="text-lg leading-none">{'›'}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {visibleTestimonials.map((t) => (
              <TestimonialCard key={t.name} quote={t.quote} name={t.name} company={t.company} />
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-16">
          <div className="overflow-hidden rounded-[2rem] border border-emerald-400/40 bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 px-6 py-10 text-center text-slate-950 md:px-10 md:text-left">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
              <div>
                <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                  Start Running Your Cleaning Business Smarter
                </h2>
                <p className="mt-2 text-sm font-medium text-emerald-950/80">
                  Launch your CleanFlow trial in minutes. Connect your existing app and give your team a
                  calmer workday.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 md:justify-end">
                <a
                  href={TRIAL_URL}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-xs font-black uppercase tracking-[0.25em] text-emerald-200 hover:bg-slate-900"
                >
                  Start Free Trial
                  <ArrowRight size={16} />
                </a>
                <a
                  href={COMPANY_LOGIN_URL}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-900/40 bg-emerald-300/40 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-200"
                >
                  Company Login
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-slate-950/90 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-sm text-slate-300/80 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              CleanFlow
            </p>
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} CleanFlow. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#features" className="hover:text-emerald-300">
              Features
            </a>
            <a href="#pricing" className="hover:text-emerald-300">
              Pricing
            </a>
            <a href="/privacy" className="hover:text-emerald-300">
              Privacy
            </a>
            <a href="/terms" className="hover:text-emerald-300">
              Terms
            </a>
            <a href="/data-and-cookies" className="hover:text-emerald-300">
              Data &amp; Cookies
            </a>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href={CUSTOMER_LOGIN_URL} className="hover:text-emerald-300">
              Customer Login
            </a>
            <a href={COMPANY_LOGIN_URL} className="hover:text-emerald-300">
              Company Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/80">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
      <p className="mt-2 text-xs text-slate-300/80">{description}</p>
    </div>
  );
}

interface WorkflowStepProps {
  step: string;
  title: string;
  description: string;
}

function WorkflowStep({ step, title, description }: WorkflowStepProps) {
  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-black text-slate-950">
        {step}
      </div>
      <h3 className="text-sm font-semibold text-slate-50">{title}</h3>
      <p className="mt-2 text-xs text-slate-300/80">{description}</p>
    </li>
  );
}

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  highlights: string[];
  popular?: boolean;
}

function PricingCard({ name, price, description, highlights, popular }: PricingCardProps) {
  return (
    <div
      className={`flex flex-col rounded-3xl border bg-slate-950/50 p-5 ${
        popular
          ? 'border-emerald-400/80 shadow-[0_24px_80px_rgba(16,185,129,0.35)]'
          : 'border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.7)]'
      }`}
    >
      {popular && (
        <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
          <Star size={12} className="text-amber-300" /> Most popular
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-50">{name}</h3>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-50">{price}</span>
        <span className="text-xs text-slate-400">/month</span>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-slate-200/90">
        {highlights.map((h) => (
          <li key={h} className="flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-300" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <a
        href={TRIAL_URL}
        className={`mt-5 inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] ${
          popular ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300' : 'bg-slate-900 text-emerald-200 hover:bg-slate-800'
        }`}
      >
        Start Free Trial
      </a>
    </div>
  );
}

interface TestimonialCardProps {
  quote: string;
  name: string;
  company: string;
}

function TestimonialCard({ quote, name, company }: TestimonialCardProps) {
  return (
    <figure className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-950/50 p-5">
      <Quote className="h-5 w-5 text-emerald-300" />
      <blockquote className="mt-3 text-sm text-slate-100">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="mt-4 text-xs text-slate-300/90">
        <p className="font-semibold text-slate-50">{name}</p>
        <p className="text-slate-400">{company}</p>
      </figcaption>
    </figure>
  );
}

