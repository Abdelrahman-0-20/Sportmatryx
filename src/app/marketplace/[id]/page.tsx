import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, LinkButton } from "@/components/ui/primitives";
import { requireReadForGuest } from "@/lib/offline";
import {
  listProducts,
  productSourceSummary,
  productImages,
  type MarketProduct,
  type MarketProductImage,
} from "@/lib/services/marketplace";
import { AddToCartButton } from "@/components/marketplace/add-to-cart-button";

export const dynamic = "force-dynamic";

export default async function MarketplaceProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: MarketProduct | null = null;
  try {
    await requireReadForGuest("roster.read");
    const catalog = await listProducts();
    product = catalog.find((p) => p.id === id) ?? null;
  } catch (e) {
    const { errorToResponse, UnauthorizedError } = await import("@/lib/auth/rbac");
    if (e instanceof UnauthorizedError) {
      const { redirect } = await import("next/navigation");
      redirect("/login");
    }
    const mapped = errorToResponse(e);
    return (
      <AppShell crumb="/marketplace" title="Marketplace">
        <p className="text-sm text-compromised">{mapped.body.error}</p>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell crumb="/marketplace" title="Marketplace">
        <p className="text-sm text-muted">Product not found.</p>
      </AppShell>
    );
  }

  const source = await productSourceSummary(product);
  let images: MarketProductImage[] = [];
  try {
    images = await productImages(product.id);
  } catch {
    // Photo gallery is additive — catalog details still render without it.
  }

  return (
    <AppShell crumb={`/marketplace/${product.id}`} title={product.name}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="card-lift" ariaLabel={product.name}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted">{product.sourceLabel} · {product.id}</p>
                <h1 className="display-heading text-2xl">{product.name}</h1>
                <Tag label={product.tag} className="mt-1" />
                {product.featured ? (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
                    ★ Best in demo
                  </div>
                ) : null}
              </div>
              {product.priceCents === 0 ? (
                <span className="text-sm font-semibold text-ready">Demo · $0.00</span>
              ) : (
                <span className="text-sm font-semibold text-accent">
                  ${(product.priceCents / 100).toFixed(2)}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-muted">{product.description}</p>

            {images.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element -- database-served image, not a remote file
                  <img
                    key={img.id}
                    src={`/api/marketplace/images/${img.id}`}
                    alt={img.alt ?? `${product.name} photo`}
                    className="h-24 w-full rounded-md border border-edge object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}

            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted">
              {product.includes.map((i) => (
                <li key={i} className="rounded-full border border-edge/60 bg-panel-2 px-2 py-0.5">
                  {i}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5">
                {source.rowsEstimate !== null ? `${source.rowsEstimate} rows` : "Rows n/a"}
              </span>
              <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5">
                Source: {source.sourceLabel}
              </span>
              {source.sourceRef ? (
                <span className="rounded-full border border-edge bg-panel-2 px-2 py-0.5 font-mono">
                  {source.sourceRef}
                </span>
              ) : null}
            </div>
          </Card>

          {source.previewRows.length > 0 ? (
            <Card ariaLabel="Source summary">
              <CardLabel>Source summary</CardLabel>
              <dl className="grid gap-2 md:grid-cols-2 text-sm">
                {source.previewRows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-2">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="tabular font-semibold text-ink">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardLabel>Add to cart</CardLabel>
            <p className="text-sm text-muted">
              {product.priceCents === 0
                ? "Demo item — no charge. Proceeds to a clearly-labeled demo checkout."
                : `Demo price: ${(product.priceCents / 100).toFixed(2)} ${product.currency}.`}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <AddToCartButton
                productId={product.id}
                name={product.name}
                priceCents={product.priceCents}
                tag={product.tag}
              />
              <LinkButton href="/marketplace/cart" variant="ghost" className="w-full">
                Open cart
              </LinkButton>
              <LinkButton href="/marketplace" variant="ghost" className="w-full">
                Back to marketplace
              </LinkButton>
            </div>
            <p className="mt-3 text-xs text-muted">
              Checkout is a demo flow — no payment is processed.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
