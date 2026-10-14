"use client";

import { useState } from "react";
import { MarketplaceCart } from "@/components/marketplace/cart";
import { ProductCard } from "@/components/marketplace/product-card";
import { FeaturedSpotlight } from "@/components/marketplace/featured-spotlight";
import { SellListing } from "@/components/marketplace/sell-listing";
import {
  MarketplaceProvider,
  useMarketplace,
  filteredProducts,
  type MarketplaceFilters,
} from "@/components/marketplace/marketplace-state";
import type { MarketProduct, CartItem } from "@/lib/services/marketplace";

const TAG_OPTIONS = [
  { value: "", label: "All tags" },
  { value: "SAMPLE", label: "SAMPLE" },
  { value: "ESTABLISHED", label: "ESTABLISHED" },
  { value: "PROTOTYPE", label: "PROTOTYPE" },
];

const AVAILABLE_OPTIONS = [
  { value: "", label: "All availability" },
  { value: "true", label: "Available only" },
  { value: "false", label: "Unavailable only" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "score", label: "Price (high to low)" },
  { value: "tag", label: "Tag" },
  { value: "price", label: "Price (low to high)" },
];

export function MarketplaceListing({ products }: { products: MarketProduct[] }) {
  return (
    <MarketplaceProvider>
      <MarketplaceListInner products={products} />
    </MarketplaceProvider>
  );
}

function MarketplaceListInner({ products }: { products: MarketProduct[] }) {
  const { filters, setFilters } = useMarketplace();
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [view, setView] = useState<"buy" | "sell">("buy");
  const featured = products.find((p) => p.featured) ?? null;
  const filtered = filteredProducts(products, filters);

  function addToCart(product: MarketProduct) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          priceCents: product.priceCents,
          quantity: 1,
          tag: product.tag,
          sourceLabel: product.sourceLabel,
        },
      ];
    });
    setCartOpen(true);
  }

  const totalItems = items.reduce((a, i) => a + i.quantity, 0);
  const totalCents = items.reduce((a, i) => a + i.priceCents * i.quantity, 0);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView("buy")}
          className={view === "buy"
            ? "rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
            : "rounded-md border border-edge bg-panel-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"}
          aria-pressed={view === "buy"}
        >
          Buy data
        </button>
        <button
          type="button"
          onClick={() => setView("sell")}
          className={view === "sell"
            ? "rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
            : "rounded-md border border-edge bg-panel-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"}
          aria-pressed={view === "sell"}
        >
          Sell / list
        </button>
      </div>

      {view === "sell" ? (
        <SellListing />
      ) : (
        <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search products, datasets, source…"
            className="w-full rounded-md border border-edge bg-panel-2 px-3 py-2 pl-9 text-sm placeholder:text-muted focus:border-accent"
            aria-label="Search marketplace products"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path d="M5 3.5l4 4M10 3.5l-3 3M2 3.5h10M2 3.5c0 2.5 2 4.5 4.5 4.5S11 6 11 3.5S9 1.5 6.5 1.5S2 1 2 3.5z" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </div>

        <select
          value={filters.tag ?? ""}
          onChange={(e) => setFilters({ ...filters, tag: e.target.value || null })}
          className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
          aria-label="Filter by tag"
        >
          {TAG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.available ? (filters.available === true ? "true" : "false") : ""}
          onChange={(e) => {
            const v = e.target.value;
            setFilters({
              ...filters,
              available: v === "true" ? true : v === "false" ? false : null,
            });
          }}
          className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
          aria-label="Filter by availability"
        >
          {AVAILABLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value as MarketplaceFilters["sort"] })}
          className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
          aria-label="Sort products"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="tabular">{filtered.length}</span>
          <span className="opacity-60">/ {products.length}</span>
        </div>

        <div className="flex items-center gap-2">
          {totalItems > 0 && (
            <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-xs tabular text-muted">
              Cart: {totalItems} item{totalItems === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setCartOpen((v) => !v)}
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20"
        >
          {cartOpen ? "Close cart" : "Open cart"}
        </button>
      </div>

      {filters.query && (
        <div className="mb-3 text-xs text-muted">
          Showing results for “{filters.query}”. Clear to see all products.
        </div>
      )}

      {featured ? (
        <FeaturedSpotlight product={featured} onAddToCart={addToCart} />
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-muted">No products match your filters.</p>
          <button
            type="button"
            onClick={() => setFilters({ query: "", tag: null, available: null, dataType: null, sort: "name" })}
            className="mt-3 rounded-md border border-edge bg-panel-2 px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="stagger mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={() => addToCart(p)} />
          ))}
        </div>
      )}

      </>
      )}

      <MarketplaceCart
        items={items}
        onUpdate={setItems}
        onOpenFullCart={() => setCartOpen(false)}
        open={cartOpen}
        onOpenChange={setCartOpen}
      />
    </>
  );
}
