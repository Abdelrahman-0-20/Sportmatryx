import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-accent/40 bg-accent/10 text-accent",
        ready: "border-ready/40 bg-ready/10 text-ready",
        monitor: "border-monitor/40 bg-monitor/10 text-monitor",
        compromised: "border-compromised/40 bg-compromised/10 text-compromised",
        withheld: "border-dashed border-withheld/60 text-withheld",
        critical: "border-critical/40 bg-critical/10 text-critical",
        prototype: "border-prototype/50 bg-prototype/20 text-purple-300",
        muted: "border-edge text-muted",
        outline: "border-edge text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Map a status enum value to a badge variant (avoids manual mapping everywhere). */
export function statusVariant(label: string): VariantProps<typeof badgeVariants>["variant"] {
  switch (label) {
    case "READY":
    case "VALID":
    case "COMPLETED":
    case "OPEN":
    case "GRANTED":
      return "ready";
    case "MONITOR":
    case "LIMITED":
    case "PARTIAL_SUCCESS":
    case "MODERATE":
    case "WARNING":
      return "monitor";
    case "COMPROMISED":
    case "HIGH":
    case "FAILED":
    case "REVOKED":
    case "RESTRICTED":
      return "compromised";
    case "WITHHELD":
    case "INSUFFICIENT_BASELINE":
    case "INSUFFICIENT_DATA":
      return "withheld";
    case "CRITICAL":
      return "critical";
    case "PROTOTYPE":
    case "ESTABLISHED":
    case "DERIVED":
      return "prototype";
    default:
      return "muted";
  }
}