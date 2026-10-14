"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function CartIcon({
  totalItems,
  onOpen,
}: {
  totalItems: number;
  onOpen?: () => void;
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (totalItems > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(timer);
    }
  }, [totalItems]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open cart, ${totalItems} item${totalItems === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent",
        pulse && "ring-1 ring-accent/40",
      )}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M2 12.5H11M5 12.5V8.5L6.5 6l2 2.5V12.5M10 12.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12.5" cy="2" r="1.3" fill="currentColor" />
      </svg>
      {totalItems > 0 ? (
        <span className="tabular tabular-nums">{totalItems}</span>
      ) : null}
      {pulse ? <AddedPulse active /> : null}
    </button>
  );
}

function AddedPulse({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-block animate-in fade-in-0 zoom-in-95" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1.5 6.5l2.5 2.5 4.5-5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
