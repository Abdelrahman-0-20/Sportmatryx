"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/primitives";
import { Tag } from "@/components/ui/primitives";

export type CartItem = {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  tag?: string;
  sourceLabel?: string;
};

export function MarketplaceCart({
  items,
  onUpdate,
  onOpenFullCart,
  open: openProp,
  onOpenChange,
}: {
  items: CartItem[];
  onUpdate: (items: CartItem[]) => void;
  onOpenFullCart?: () => void;
  // Optional controlled mode: the parent owns open/close so "Add to cart"
  // can open this dialog directly. Falls back to internal state otherwise.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  function setOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function setQuantity(productId: string, quantity: number) {
    const next = items.map((i) =>
      i.productId === productId ? { ...i, quantity: Math.max(0, quantity) } : i,
    );
    onUpdate(next.filter((i) => i.quantity > 0));
  }

  function remove(productId: string) {
    onUpdate(items.filter((i) => i.productId !== productId));
  }

  function clear() {
    onUpdate([]);
  }

  const totalItems = items.reduce((a, i) => a + i.quantity, 0);
  const totalCents = items.reduce((a, i) => a + i.priceCents * i.quantity, 0);

  function lineTotalCents(item: CartItem) {
    return item.priceCents * item.quantity;
  }

  function formatCents(cents: number) {
    return cents === 0 ? "$0.00" : `$${(cents / 100).toFixed(2)}`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
        aria-label="Open cart"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 12.5H11M5 12.5V8.5L6.5 6l2 2.5V12.5M10 12.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="2" r="1.2" fill="currentColor" />
        </svg>
        {totalItems > 0 ? <span className="tabular">{totalItems}</span> : null}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-10 p-4 bg-canvas/70"
          role="dialog"
          aria-modal="true"
          aria-label="Cart"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-[10px] border border-edge bg-panel p-4 shadow-[var(--shadow-float)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <div className="flex items-center gap-2">
                <h2 className="display-heading text-lg">Cart</h2>
                {totalItems > 0 ? (
                  <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-xs tabular text-muted">
                    {totalItems} item{totalItems === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Close cart">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M3 3l12 12M3 15L15 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Your cart is empty.</p>
                <div className="mt-3 flex justify-center">
                  <LinkButton href="/marketplace" variant="ghost" className="text-xs">Browse marketplace</LinkButton>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((i) => (
                  <li key={i.productId} className="flex items-start justify-between gap-3 border border-edge/60 rounded-md bg-panel-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {i.tag ? <Tag label={i.tag} /> : null}
                        <span className="truncate text-sm font-semibold">{i.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted truncate">
                        {i.sourceLabel ? `${i.sourceLabel} · ` : ""}
                        {i.priceCents === 0 ? "Demo — no charge" : `$${(i.priceCents / 100).toFixed(2)} each`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button type="button" disabled={i.quantity <= 1} onClick={() => setQuantity(i.productId, i.quantity - 1)} className="rounded-md border border-edge bg-panel px-2 py-1 text-xs font-semibold hover:bg-panel-2 disabled:opacity-50" aria-label={`Decrease quantity of ${i.name}`}>−</button>
                        <span className="tabular text-sm font-semibold w-5 text-center">{i.quantity}</span>
                        <button type="button" onClick={() => setQuantity(i.productId, i.quantity + 1)} className="rounded-md border border-edge bg-panel px-2 py-1 text-xs font-semibold hover:bg-panel-2" aria-label={`Increase quantity of ${i.name}`}>+</button>
                        <button type="button" onClick={() => remove(i.productId)} className="ml-auto text-xs text-compromised hover:underline" aria-label={`Remove ${i.name}`}>Remove</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 tabular text-sm font-semibold">
                      {i.priceCents === 0 ? (
                        <span className="text-ready">$0.00</span>
                      ) : (
                        <>
                          <span className="text-muted">${(i.priceCents / 100).toFixed(2)}</span>
                          <span className="text-muted">×</span>
                          <span className="tabular">{i.quantity}</span>
                          <span className="text-muted">=</span>
                          <span className="tabular">{formatCents(lineTotalCents(i))}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-edge pt-3">
              <div className="text-sm">
                <span className="text-muted">{totalItems} item{totalItems === 1 ? "" : "s"}</span>
                <span className="ml-2 tabular">{formatCents(totalCents)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={clear} className="px-3 text-xs">Clear</Button>
                <LinkButton href="/marketplace/cart" className="px-3 text-xs">View full cart</LinkButton>
              </div>
            </div>

            {onOpenFullCart ? (
              <div className="mt-2 text-center">
                <button type="button" onClick={() => { setOpen(false); onOpenFullCart() }} className="text-xs text-accent hover:underline">
                  Review full cart and checkout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
