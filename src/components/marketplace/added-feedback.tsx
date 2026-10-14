"use client";

import { useState } from "react";

export function useAddedFeedback() {
  const [pulse, setPulse] = useState(false);
  const markAdded = () => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 700);
    return timer;
  };
  return { pulse, markAdded };
}

export function AddedPulse({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-block animate-in fade-in-0 zoom-in-95" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
