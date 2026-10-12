import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware class combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initials fallback from a "Last, First." display string. Server-safe (pure). */
export function initialsOf(display: string): string {
  const parts = display.replace(/\./g, "").split(",").map((p) => p.trim());
  const last = parts[0] ?? "";
  const first = parts[1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase() || "?";
}
