import type { ReactNode } from "react";
import Link from "next/link";

/** Panel container (Panel #101B2E, border #1E2D45). Optional soft elevation. */
export function Card({
  children,
  className = "",
  ariaLabel,
  variant = "flat",
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  variant?: "flat" | "elevated";
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-[10px] border border-edge bg-panel p-4 ${
        variant === "elevated" ? "shadow-[var(--shadow-card)]" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-canvas hover:bg-cyan-300",
  ghost: "border border-edge text-ink hover:bg-panel-2",
  danger: "border border-compromised text-compromised hover:bg-compromised/10",
} as const;

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex min-h-[36px] items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[36px] items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

const TAG_STYLES: Record<string, string> = {
  READY: "bg-ready/15 text-ready border-ready/40",
  MONITOR: "bg-monitor/15 text-monitor border-monitor/40",
  COMPROMISED: "bg-compromised/15 text-compromised border-compromised/40",
  WITHHELD: "border-dashed border-withheld text-withheld",
  VALID: "bg-ready/15 text-ready border-ready/40",
  LIMITED: "bg-monitor/15 text-monitor border-monitor/40",
  RETEST: "bg-critical/15 text-critical border-critical/40",
  INSUFFICIENT_BASELINE: "border-dashed border-withheld text-withheld",
  ESTABLISHED: "bg-prototype/20 text-purple-300 border-prototype/40",
  DERIVED: "bg-prototype/20 text-purple-300 border-prototype/40",
  PROTOTYPE: "bg-prototype/25 text-purple-300 border-prototype/50",
  CRITICAL: "bg-critical/15 text-critical border-critical/40",
  HIGH: "bg-compromised/15 text-compromised border-compromised/40",
  MODERATE: "bg-monitor/15 text-monitor border-monitor/40",
  POSITIVE: "text-positive",
  NEGATIVE: "text-monitor",
};

/** Status/evidence tag — always text + color (never color alone). */
export function Tag({ label, className = "", glow = false }: { label: string; className?: string; glow?: boolean }) {
  const style = TAG_STYLES[label] ?? "border-edge text-muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style} ${glow ? "glow-ready" : ""} ${className}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

/** WITHHELD stamp — dashed outline, unmistakable state. */
export function WithheldStamp({ code }: { code?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border-2 border-dashed border-withheld px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-withheld"
      title={code ? `Withheld: ${code}` : "Score withheld by a validity gate"}
    >
      Withheld{code ? ` · ${code}` : ""}
    </span>
  );
}

/** Confidence ring (cyan ≥90, amber 70–89, red <70). Text alongside color. */
export function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct >= 90 ? "var(--color-ready)" : pct >= 70 ? "var(--color-monitor)" : "var(--color-compromised)";
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${pct}%`}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-edge)" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
          className="ring-anim"
          style={{ ["--smx-circ" as string]: String(c) }}
        />
      </svg>
      <span className="tabular text-xs text-muted">{pct}%</span>
    </span>
  );
}

/** Inline sparkline (custom SVG — gaps rendered as dashes, never zero). */
export function Sparkline({
  points,
  width = 96,
  height = 28,
}: {
  points: (number | null)[];
  width?: number;
  height?: number;
}) {
  const valid = points.filter((p): p is number => p !== null);
  if (valid.length === 0) {
    return <span className="text-xs text-muted" aria-label="No trend data">—</span>;
  }
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const span = Math.max(hi - lo, 1e-6);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const segs: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p === null) {
      if (current.length > 1) segs.push(current.join(" "));
      current = [];
      return;
    }
    const x = i * step;
    const y = height - 3 - ((p - lo) / span) * (height - 6);
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segs.push(current.join(" "));
  return (
    <svg width={width} height={height} aria-hidden="true" className="sparkline overflow-visible">
      {segs.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" style={{ ["--smx-len" as string]: String(width * 2) }} />
      ))}
    </svg>
  );
}

/** Number display with evidence tag slot. */
export function HeroNumber({
  value,
  suffix,
  tag,
}: {
  value: number | string;
  suffix?: string;
  tag?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="hero-number text-5xl md:text-6xl">{value}</span>
      {suffix ? <span className="hero-number text-xl text-muted">{suffix}</span> : null}
      {tag ? <Tag label={tag} /> : null}
    </div>
  );
}
