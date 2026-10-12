"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/team-command";
  const [email, setEmail] = useState("performance@demo.sportmetryx.dev");
  const [password, setPassword] = useState("Demo-SMX-2024!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        setBusy(false);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Login failed.");
          return;
        }
        router.push(next);
        router.refresh();
      }}
    >
      <label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-h-[40px] rounded-md border border-edge bg-panel px-3 text-sm"
        autoComplete="username"
      />
      <label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="min-h-[40px] rounded-md border border-edge bg-panel px-3 text-sm"
        autoComplete="current-password"
      />
      {error ? (
        <p role="alert" className="text-sm text-compromised">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="btn-sheen mt-2 min-h-[40px] rounded-md bg-accent px-4 text-sm font-bold text-canvas transition-transform hover:scale-[1.02] hover:bg-cyan-300 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Development-only demo accounts (all use the seeded password shown above). Production
        deployments must provision real accounts and rotate these credentials.
      </p>
    </form>
  );
}
