"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label="Sign out"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-compromised"
    >
      {busy ? "…" : "Sign out"}
    </button>
  );
}
