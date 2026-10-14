"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function CheckoutForm({
  items,
  totalCents,
  onSubmit,
  busy,
  setBusy,
}: {
  items: { productId: string; name: string; priceCents: number; quantity: number }[];
  totalCents: number;
  onSubmit: (items: { productId: string; quantity: number }[], email: string, name: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  function submit() {
    if (items.length === 0) return;
    if (!email || !name) return;
    setBusy(true);
    onSubmit(
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      email.trim(),
      name.trim(),
    );
  }

  return (
    <div className="rounded-[10px] border border-edge bg-panel p-4">
      <p className="text-xs text-muted">
        DEMO CHECKOUT — no payment processing, no money moved.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Email (demo)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Name (demo)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex gap-2">
          <Button onClick={submit} disabled={busy || !email || !name} className="flex-1">
            {busy ? "Placing demo order…" : "Place demo order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
