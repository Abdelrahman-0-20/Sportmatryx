"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Intervention action buttons. Approve records a review only — the API enforces
 * this and writes an audit record. No outbound messaging or scheduling exists.
 */
export function InterventionActions({
  id,
  status,
  canReview,
}: {
  id: string;
  status: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: string, notes?: string) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/interventions/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notes ? { notes } : {}),
    });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Action failed.");
      return;
    }
    setDismissOpen(false);
    setReason("");
    router.refresh();
  }

  if (!canReview) {
    return <span className="text-xs text-muted">View only (review capability required)</span>;
  }

  const active = status === "OPEN" || status === "ASSIGNED" || status === "UNDER_REVIEW";
  const snoozed = status === "FOLLOW_UP_REQUIRED";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {error ? <span role="alert" className="text-xs text-compromised">{error}</span> : null}
      {active ? (
        <>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("approve")}
            className="min-h-[30px] rounded bg-accent px-2.5 text-xs font-bold text-canvas hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy === "approve" ? "…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("snooze")}
            className="min-h-[30px] rounded border border-edge px-2.5 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50"
          >
            {busy === "snooze" ? "…" : "Snooze 24h"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setDismissOpen((v) => !v)}
            className="min-h-[30px] rounded border border-edge px-2.5 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50"
          >
            Dismiss
          </button>
          {dismissOpen ? (
            <span className="flex items-center gap-1.5">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                aria-label="Dismissal reason"
                className="min-h-[30px] w-44 rounded border border-edge bg-panel px-2 text-xs"
              />
              <button
                type="button"
                disabled={reason.trim().length === 0 || busy !== null}
                onClick={() => act("dismiss", reason.trim())}
                className="min-h-[30px] rounded border border-compromised px-2.5 text-xs font-semibold text-compromised disabled:opacity-50"
              >
                Confirm
              </button>
            </span>
          ) : null}
        </>
      ) : snoozed ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act("restore")}
          className="min-h-[30px] rounded border border-edge px-2.5 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50"
        >
          {busy === "restore" ? "…" : "Restore"}
        </button>
      ) : (
        <span className="text-xs text-muted">{status.replace(/_/g, " ")}</span>
      )}
    </div>
  );
}
