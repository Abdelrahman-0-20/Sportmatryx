"use client";

import { Card, Tag, Button, LinkButton } from "@/components/ui/primitives";
import type { MarketProduct } from "@/lib/services/marketplace";

/**
 * Spotlight for the demo's flagship device package. Rendered above the
 * marketplace grid; claims are scoped to this demo (see featuredNote).
 */
export function FeaturedSpotlight({
  product,
  onAddToCart,
}: {
  product: MarketProduct;
  onAddToCart: (product: MarketProduct) => void;
}) {
  return (
    <Card className="card-lift mb-4 border border-accent/40" ariaLabel={`Featured: ${product.name}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M5.5 0.8l1.35 2.75 3.03.44-2.19 2.14.52 3.02L5.5 7.75 2.79 9.15l.52-3.02L1.12 3.99l3.03-.44L5.5.8z" fill="currentColor" />
              </svg>
              Best in demo
            </span>
            <span className="text-xs text-muted">{product.sourceLabel}</span>
          </div>

          <h2 className="display-heading mt-1.5 text-xl">{product.name}</h2>

          {product.featuredNote ? (
            <p className="mt-1 text-xs font-semibold text-accent">{product.featuredNote}</p>
          ) : null}

          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">{product.description}</p>

          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
            {product.includes.map((i) => (
              <li key={i} className="rounded-full border border-edge/60 bg-panel-2 px-2 py-0.5">
                {i}
              </li>
            ))}
          </ul>

          <div className="mt-3">
            <Tag label={product.tag} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <div className="text-right">
            <div className="tabular text-2xl font-bold text-accent">
              ${(product.priceCents / 100).toFixed(2)}
              <span className="ml-1 text-xs font-semibold text-muted">USD · demo price</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {product.rowsEstimate !== null ? `${product.rowsEstimate} rows (synthetic)` : "Rows n/a"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => onAddToCart(product)}
              aria-label={`Add ${product.name} to cart`}
            >
              Add to cart
            </Button>
            <LinkButton href={`/marketplace/${product.id}`} variant="ghost">
              View details
            </LinkButton>
          </div>
        </div>
      </div>
    </Card>
  );
}