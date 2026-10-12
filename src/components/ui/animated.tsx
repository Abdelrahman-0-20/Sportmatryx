"use client";

import { useEffect, useState } from "react";

/**
 * Count-up hero number (client). Respects prefers-reduced-motion by jumping
 * straight to the final value. Never used for withheld/null values.
 */
export function AnimatedNumber({
  value,
  decimals = 1,
  durationMs = 900,
  className = "",
}: {
  value: number;
  decimals?: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Deferred to a task so the effect does not synchronously re-render.
      const id = setTimeout(() => setDisplay(value), 0);
      return () => clearTimeout(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}

/** Live relative-time text ("updated 4 min ago") that ticks every minute. */
export function LiveRelative({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Defer the first clock read to a task (purity rule: no sync setState in effect).
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const mins = now === null ? 0 : Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  const text = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="live-dot" aria-hidden="true" />
      {prefix}
      {text}
    </span>
  );
}
