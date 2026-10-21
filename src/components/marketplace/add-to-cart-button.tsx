"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { useAddedFeedback } from "@/components/marketplace/added-feedback";

/**
 * Client island for the product detail page: adds the product to the
 * server-side cart (cookie-backed) so it persists across pages.
 * The /api/marketplace/cart-state POST contract replaces the full items
 * list, so we GET the current cart, merge, then POST it back.
 */
export function AddToCartButton({
  productId,
  name,
  priceCents,
  tag,
}: {
  productId: string;
  name: string;
  priceCents: number;
  tag?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pulse, markAdded } = useAddedFeedback();

  async function addToCart() {
    setPending(true);
    setError(null);
    try {
      const current = await fetch("/api/marketplace/cart-state", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: unknown[] }>) : { items: [] }))
        .then((d) => (Array.isArray(d.items) ? d.items : []));

      const existing = current.find(
        (i): i is { productId: string; name: string; priceCents: number; quantity: number; tag?: string } =>
          typeof i === "object" && i !== null && "productId" in i && (i as { productId: unknown }).productId === productId,
      );

      const next = existing
        ? current.map((i) =>
            i === existing ? { ...existing, quantity: existing.quantity + 1 } : i,
          )
        : [...current, { productId, name, priceCents, quantity: 1, tag }];

      const res = await fetch("/api/marketplace/cart-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: next }),
      });
      if (!res.ok) throw new Error(`Cart update failed (${res.status})`);
      markAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to cart.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={addToCart} disabled={pending} className={`w-full ${pulse ? "opacity-80" : ""}`}>
        {pending ? "Adding…" : pulse ? "✓ Added to cart" : "Add to cart"}
      </Button>
      {error ? <p className="text-xs text-compromised">{error}</p> : null}
    </div>
  );
}
