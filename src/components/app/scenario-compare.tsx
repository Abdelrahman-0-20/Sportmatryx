"use client";

import { useEffect, useState } from "react";

/**
 * Scenario compare panel (PROTOTYPE). Always shows the amber banner:
 * hypothetical exploration, not a forecast. Calls the server engine.
 */
interface SimResult {
  disclaimer: string;
  baseIndex: number;
  simulatedIndex: number;
  delta: number;
  components: { component: string; deltaIndexPoints: number }[];
}

const SLIDERS = [
  { key: "tzShiftHours", label: "Time-zone shift", min: -12, max: 12, step: 1, unit: "h", def: 0 },
  { key: "heatIndexC", label: "Heat index", min: 0, max: 55, step: 1, unit: "°C", def: 24 },
  { key: "aqi", label: "Air quality", min: 0, max: 300, step: 1, unit: "AQI", def: 40 },
  { key: "altitudeM", label: "Altitude", min: 0, max: 4000, step: 100, unit: "m", def: 200 },
  { key: "sleepHours", label: "Sleep", min: 0, max: 12, step: 0.5, unit: "h", def: 8 },
  { key: "practiceLoadPct", label: "Practice load", min: 50, max: 200, step: 5, unit: "%", def: 100 },
] as const;

type ScenarioKey = (typeof SLIDERS)[number]["key"];

export function ScenarioCompare({ athleteId }: { athleteId: string }) {
  const [scenario, setScenario] = useState<Record<ScenarioKey, number>>(
    Object.fromEntries(SLIDERS.map((s) => [s.key, s.def])) as Record<ScenarioKey, number>,
  );
  const [result, setResult] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setBusy(true);
      const res = await fetch("/api/twin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...scenario }),
      });
      setBusy(false);
      if (res.ok) setResult((await res.json()) as SimResult);
    }, 250);
    return () => clearTimeout(timer);
  }, [athleteId, scenario]);

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md border border-monitor/50 bg-monitor/10 p-2.5 text-sm font-semibold text-monitor" role="note">
        HYPOTHETICAL EXPLORATION: NOT A FORECAST
      </p>

      {SLIDERS.map((s) => (
        <label key={s.key} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-muted">{s.label}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={scenario[s.key]}
            aria-label={s.label}
            onChange={(e) => setScenario((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))}
            className="w-full accent-cyan-400 transition-transform hover:scale-y-125"
          />
          <span className="tabular w-16 shrink-0 text-right font-semibold">
            {scenario[s.key]}{s.unit}
          </span>
        </label>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-edge bg-panel-2 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted">Base</div>
          <div className="hero-number text-4xl text-ready">{result ? result.baseIndex.toFixed(1) : "—"}</div>
        </div>
        <div className="rounded-md border border-edge bg-panel-2 p-3 text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted">Simulated</div>
          <div className="hero-number text-4xl text-monitor">{result ? result.simulatedIndex.toFixed(1) : "—"}</div>
        </div>
      </div>

      <div className={`rounded-md border p-3 text-center ${result && result.delta < -5 ? "border-critical/50 bg-critical/10" : "border-edge bg-panel-2"}`}>
        <div className="text-[10px] uppercase tracking-widest text-muted">Delta</div>
        <div className={`hero-number text-4xl ${result ? (result.delta < 0 ? "text-compromised" : "text-ready") : ""}`}>
          {result ? `${result.delta > 0 ? "+" : ""}${result.delta.toFixed(1)}` : "—"}
        </div>
      </div>

      {result ? (
        <p className="text-xs text-muted">
          {busy ? "Recomputing…" : "Per-component deltas: "}
          {result.components.filter((c) => c.deltaIndexPoints !== 0).map((c) => `${c.component.replace(/_/g, " ").toLowerCase()} ${c.deltaIndexPoints > 0 ? "+" : ""}${c.deltaIndexPoints}`).join(" · ") || "none"}
        </p>
      ) : null}
      <p className="text-[11px] text-muted">
        Prototype sensitivity curves — documented in code, bounded and monotonic. No forecast claim.
      </p>
    </div>
  );
}
