"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATES = ["GRANTED", "RESTRICTED", "REVOKED"] as const;

export function ConsentPanel({
  athleteId,
  current,
  canWrite,
}: {
  athleteId: string;
  current: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof STATES)[number]>(current as (typeof STATES)[number]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function commit() {
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await fetch(`/api/athletes/${athleteId}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selected, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Change failed.");
      return;
    }
    setDone(`Consent changed to ${selected}. Append-only record + audit entry created.`);
    setReason("");
    router.refresh();
  }

  if (!canWrite) {
    return (
      <p className="text-sm text-muted">
        Current consent state: {current}. Only Medical, Executive and Admin roles can write consent
        changes (server-enforced).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="radiogroup" aria-label="Consent state">
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected === s}
            onClick={() => setSelected(s)}
            className={`min-h-[36px] rounded-md border px-4 text-sm font-bold ${
              selected === s ? "border-accent bg-accent text-canvas" : "border-edge text-ink hover:bg-panel-2"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="change-reason">
        Change reason (required)
      </label>
      <textarea
        id="change-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g., Updating after post-travel consent re-evaluation…"
        className="rounded-md border border-edge bg-panel px-3 py-2 text-sm"
      />
      <p className="text-xs text-muted">
        Submitting creates an append-only, tamper-evident audit and consent record.
      </p>
      {error ? <p role="alert" className="text-sm text-compromised">{error}</p> : null}
      {done ? <p role="status" className="text-sm text-ready">{done}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={commit}
          className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-bold text-canvas hover:bg-cyan-300 disabled:opacity-50"
        >
          {busy ? "Committing…" : "Authorize and commit change"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelected(current as (typeof STATES)[number]);
            setReason("");
            setError(null);
            setDone(null);
          }}
          className="min-h-[40px] rounded-md border border-edge px-4 text-sm font-semibold hover:bg-panel-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
