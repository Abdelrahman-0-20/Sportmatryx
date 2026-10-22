"use client";

import { useMarketplace } from "@/components/marketplace/marketplace-state";
import { useAddedFeedback } from "@/components/marketplace/added-feedback";
import { Card, Tag, LinkButton, Button } from "@/components/ui/primitives";
import { HighlightText } from "@/components/marketplace/highlight";
import { DownloadSamplePreview } from "@/components/marketplace/download-sample";
import type { MarketProduct } from "@/lib/services/marketplace";
import { cn } from "@/lib/utils";

export function ProductCard({ product, onAddToCart }: { product: MarketProduct; onAddToCart?: (product: MarketProduct) => void }) {
  const { filters } = useMarketplace();
  const query = filters.query;
  const hasQuery = query.trim().length > 0;
  const { pulse, markAdded } = useAddedFeedback();

  return (
    <Card className="card-lift" ariaLabel={product.name}>
      {product.imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- database-served image, not a remote file
        <img
          src={`/api/marketplace/images/${product.imageId}`}
          alt={`${product.name} cover`}
          className="mb-2 h-36 w-full rounded-md border border-edge object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {hasQuery ? (
              <HighlightText text={product.sourceLabel + (product.sourceRef ? ` · ${product.sourceRef}` : "")} query={query} />
            ) : (
              <>
                {product.sourceLabel}
                {product.sourceRef ? ` · ${product.sourceRef}` : ""}
              </>
            )}
          </p>
          <h3 className="display-heading text-lg mt-0.5">
            {hasQuery ? (
              <HighlightText text={product.name} query={query} />
            ) : (
              product.name
            )}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Tag label={product.tag} />
            {product.featured ? (
              <span className="rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                Best in demo
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          {product.priceCents === 0 ? (
            <div className="flex items-center gap-1 text-sm font-semibold text-ready">
              Demo
              <span className="tabular">$0.00</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-sm font-semibold text-accent">
              <span className="tabular">${(product.priceCents / 100).toFixed(2)}</span>
              <span className="text-muted">USD</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-muted leading-relaxed">
        {hasQuery ? (
          <HighlightText text={product.description} query={query} />
        ) : (
          product.description
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
        {product.includes.map((i) => (
          <li key={i} className="rounded-full border border-edge/60 bg-panel-2 px-2 py-0.5">
            {hasQuery ? <HighlightText text={i} query={query} /> : i}
          </li>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5">
          {product.rowsEstimate !== null ? `${product.rowsEstimate} rows` : "Rows n/a"}
        </span>
        <span className={cn(
          "rounded-full border px-2 py-0.5 font-semibold",
          product.available ? "border-ready/40 text-ready" : "border-withheld/60 text-withheld",
        )}>
          {product.available ? "Available" : "Unavailable"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <LinkButton href={`/marketplace/${product.id}`} variant="ghost" className="w-fit text-xs">
            View details
          </LinkButton>
          <Button
            variant="ghost"
            onClick={() => {
              onAddToCart?.(product);
              markAdded();
            }}
            className={cn(
              "w-fit text-xs transition-colors",
              pulse ? "border-accent bg-accent/10 text-accent" : "border-edge hover:bg-panel-2",
            )}
            aria-label={`Add ${product.name} to cart`}
          >
            {pulse ? "Added" : "Add to cart"}
          </Button>
        </div>
        {/* Sample CSV preview only makes sense for data products. Community
            listings (e.g. physical goods) never had a CSV, so hide it there. */}
        {product.tag !== "COMMUNITY" ? <DownloadSamplePreview product={product} /> : null}
      </div>
    </Card>
  );
}
