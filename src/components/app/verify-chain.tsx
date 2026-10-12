"use client";

import { useState } from "react";

interface ChainResult {
  ok: boolean;
  checked: number;
  firstBrokenSeq: number | null;
  detail: string | null;
}

export function VerifyChainButton() {
  const [result, setResult] = useState<ChainResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/audit/verify");
          setBusy(false);
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "Verification request failed.");
            return;
          }
          setResult((await res.json()) as ChainResult);
        }}
        className="min-h-[36px] w-fit rounded-md bg-accent px-3 text-sm font-bold text-canvas hover:bg-cyan-300 disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify chain"}
      </button>
      {error ? <p role="alert" className="text-sm text-compromised">{error}</p> : null}
      {result ? (
        <p className={`text-sm ${result.ok ? "text-ready" : "text-critical"}`} role="status">
          {result.ok
            ? `✓ Hash chain verified — ${result.checked} records, every link intact.`
            : `✕ Chain broken at record ${result.firstBrokenSeq}. ${result.detail ?? ""}`}
        </p>
      ) : null}
    </div>
  );
}
