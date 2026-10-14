"use client";

import { useState } from "react";
import { CheckoutForm } from "@/components/marketplace/checkout-form";

export function CheckoutIsland({
  items,
  totalCents,
  onSuccess,
}: {
  items: { productId: string; name: string; priceCents: number; quantity: number }[];
  totalCents: number;
  onSuccess?: (purchaseId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(itemRefs: { productId: string; quantity: number }[], email: string, name: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemRefs, email, name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Checkout failed.");
        return;
      }
      const purchase = (await res.json()) as { purchaseId: string };
      if (typeof window !== "undefined") {
        window.location.href = `/marketplace/cart?done=${purchase.purchaseId}`;
      }
      onSuccess?.(purchase.purchaseId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CheckoutForm
        items={items}
        totalCents={totalCents}
        onSubmit={submit}
        busy={busy}
        setBusy={setBusy}
      />
      {error ? <p className="mt-2 text-sm text-compromised">{error}</p> : null}
    </>
  );
}
