"use client";

// NEW FILE — cart-lines.tsx
// Client island for the full cart page: lets you change quantity or remove
// items. Persists through /api/marketplace/cart-state (same cookie the
// marketplace listing dialog uses), then refreshes the server-rendered page
// so re-pricing and checkout totals stay in sync. No backend changes.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tag } from "@/components/ui/primitives";
import type { CartItem } from "@/lib/services/marketplace";

export function CartLines({ items }: { items: CartItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function persist(next: CartItem[], focusId: string | null) {
    setBusyId(focusId);
    fetch("/api/marketplace/cart-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: next }),
    })
      .then(() => {
        startTransition(() => router.refresh());
      })
      .catch(() => {
        setBusyId(null);
      });
  }

  function setQuantity(productId: string, quantity: number) {
    const next = items
      .map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(0, quantity) } : i,
      )
      .filter((i) => i.quantity > 0);
    persist(next, productId);
  }

  function remove(productId: string) {
    persist(items.filter((i) => i.productId !== productId), productId);
  }

  return (
    <ul className="flex flex-col gap-2" aria-busy={pending}>
      {items.map((i) => {
        const busy = busyId === i.productId && pending;
        return (
          <li
            key={i.productId}
            className={
              busy
                ? "flex items-start justify-between gap-3 border border-edge/60 rounded-md bg-panel-2 p-3 opacity-60"
                : "flex items-start justify-between gap-3 border border-edge/60 rounded-md bg-panel-2 p-3"
            }
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {i.sourceLabel ? <Tag label={i.sourceLabel} /> : null}
                <Link
                  href={`/marketplace/${i.productId}`}
                  className="truncate text-sm font-semibold hover:text-accent"
                >
                  {i.name}
                </Link>
              </div>
              <p className="mt-1 text-xs text-muted truncate">
                {i.priceCents === 0 ? "Demo — no charge" : `$${(i.priceCents / 100).toFixed(2)} each`}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy || i.quantity <= 1}
                  onClick={() => setQuantity(i.productId, i.quantity - 1)}
                  className="rounded-md border border-edge bg-panel px-2 py-1 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50"
                  aria-label={`Decrease quantity of ${i.name}`}
                >
                  −
                </button>
                <span className="tabular text-sm font-semibold w-5 text-center">{i.quantity}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setQuantity(i.productId, i.quantity + 1)}
                  className="rounded-md border border-edge bg-panel px-2 py-1 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50"
                  aria-label={`Increase quantity of ${i.name}`}
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(i.productId)}
                  className="ml-auto text-xs text-compromised hover:underline disabled:opacity-50"
                  aria-label={`Remove ${i.name}`}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="text-right tabular text-sm font-semibold">
              {i.priceCents === 0 ? "$0.00" : `$${((i.priceCents * i.quantity) / 100).toFixed(2)}`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
