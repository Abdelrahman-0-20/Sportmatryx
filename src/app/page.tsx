import Link from "next/link";
import { HeroNumber, Tag, Sparkline } from "@/components/ui/primitives";

/**
 * Public landing page. Marketing tone permitted here ONLY; product screens
 * stay operational and calm. All telemetry is illustrative (PROTOTYPE).
 */
const TELEMETRY = [
  { label: "Heart Rate", value: "72", unit: "bpm", note: "Zone 2", points: [74, 73, 75, 72, 71, 72, 72] },
  { label: "Blood Oxygen", value: "98", unit: "%", note: "Normal", points: [97, 98, 97, 98, 98, 99, 98] },
  { label: "Respiratory Rate", value: "16", unit: "rpm", note: "Optimal", points: [17, 16, 16, 15, 16, 16, 16] },
  { label: "Air Quality", value: "AQI 12", unit: "", note: "Good", points: [18, 15, 12, 14, 12, 11, 12] },
  { label: "Training Load", value: "8.5", unit: "", note: "High", points: [7, 8, 7.5, 8, 8.5, 9, 8.5] },
  { label: "Recovery Status", value: "92", unit: "%", note: "Ready", points: [88, 90, 91, 89, 92, 93, 92] },
];

const CREDIBILITY = [
  { claim: "Validity-gated by design", tag: "ESTABLISHED" },
  { claim: "Baseline-first, not population-first", tag: "ESTABLISHED" },
  { claim: "Explainable scores, no black boxes", tag: "ESTABLISHED" },
  { claim: "Decision support, not diagnosis", tag: "ESTABLISHED" },
  { claim: "Football context at every scale", tag: "DERIVED" },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div>
          <span className="display-heading text-2xl">
            <span className="text-accent">Sportmetryx</span> Football
          </span>
          <span className="ml-3 text-xs text-muted">Powered by Healthmetryx</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/#modules" className="hidden text-muted hover:text-ink md:block">Overview</Link>
          <Link href="/#modules" className="hidden text-muted hover:text-ink md:block">Modules</Link>
          <Link href="/#governance" className="hidden text-muted hover:text-ink md:block">Governance</Link>
          <Link
            href="/login"
            className="rounded-md border border-edge px-3 py-1.5 font-semibold text-ink hover:bg-panel"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-10">
        <div>
          <p className="hero-in mb-3 text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Sportmetryx Football
          </p>
          <h1 className="display-heading text-5xl leading-[0.95] md:text-7xl">
            <span className="hero-in text-ink inline-block">Off season.</span>
            <br />
            <span className="hero-in hero-in-2 text-accent inline-block">On another level.</span>
          </h1>
          <p className="hero-in hero-in-2 display-heading mt-5 text-lg text-ink/90 md:text-xl">
            Breathe smarter. Train harder.
          </p>
          <p className="hero-in hero-in-3 mt-4 max-w-xl text-sm text-muted md:text-base">
            Measure the athlete. Understand the workload. Predict performance degradation. Protect
            availability — decision support for football performance staff, built on validity-gated,
            explainable athlete baselines.
          </p>
          <div className="hero-in hero-in-3 mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="btn-sheen min-h-[44px] rounded-md bg-accent px-5 py-2.5 text-sm font-bold text-canvas transition-transform hover:scale-[1.03] hover:bg-cyan-300"
            >
              Enter the platform
            </Link>
            <Link
              href="/#modules"
              className="min-h-[44px] rounded-md border border-edge px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent/50 hover:bg-panel"
            >
              See the architecture
            </Link>
          </div>
        </div>

        <aside aria-label="Illustrative telemetry" className="stagger flex flex-col gap-3">
          {TELEMETRY.map((t) => (
            <div key={t.label} className="card-lift rounded-[10px] border border-edge bg-panel p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {t.label}
                </span>
                <Tag label="PROTOTYPE" />
              </div>
              <div className="mt-1 flex items-end justify-between">
                <HeroNumber value={t.value} suffix={t.unit} />
                <div className="flex items-center gap-3">
                  <Sparkline points={t.points} />
                  <span className="text-xs font-semibold text-accent">{t.note}</span>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted">
            Illustrative telemetry. Prototype models. Not a medical device.
          </p>
        </aside>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <h2 className="display-heading mb-4 text-2xl">One platform. Every football decision surface.</h2>
        <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["SMX Team Command", "Exception-first operational roster, readiness distribution and review queue.", "ESTABLISHED"],
            ["SMX Performance Index", "Transparent 0–100 composite with component breakdown, confidence and drivers.", "ESTABLISHED"],
            ["SMX Load Intelligence", "Session workload, acute:chronic context and baseline comparisons.", "DERIVED"],
            ["SMX Recovery Intelligence", "HRV, sleep and recovery trajectories with retest queue.", "DERIVED"],
            ["SMX Environment", "Heat, air quality, altitude and travel exposure context.", "DERIVED"],
            ["SMX Digital Athlete Twin", "Longitudinal baseline and scenario comparison workspace.", "PROTOTYPE"],
          ].map(([name, desc, tag]) => (
            <li key={name} className="card-lift rounded-[10px] border border-edge bg-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="display-heading text-lg">{name}</h3>
                <Tag label={tag} />
              </div>
              <p className="mt-2 text-sm text-muted">{desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="governance" className="mx-auto max-w-7xl px-6 pb-10 md:px-10">
        <div className="rounded-[10px] border border-edge bg-panel p-5">
          <h2 className="display-heading mb-3 text-xl">Validity and governance principles</h2>
          <div className="grid gap-3 md:grid-cols-5">
            {CREDIBILITY.map((c) => (
              <div key={c.claim}>
                <p className="text-sm font-semibold">{c.claim}</p>
                <span className="mt-1 inline-block"><Tag label={c.tag} /></span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-xs text-muted">
          Decision support only. Not a medical device. Prototype models are for research and
          demonstration. Illustrative telemetry. Synthetic demo data only.
        </p>
      </section>
    </main>
  );
}
