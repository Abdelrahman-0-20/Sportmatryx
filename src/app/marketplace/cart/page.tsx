import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { Card, CardLabel, Tag, LinkButton } from "@/components/ui/primitives";
import { CheckoutIsland } from "@/components/marketplace/checkout-island";
import { requireCapability } from "@/lib/auth/rbac";
import { listProducts, finalizeCart, type CartItem, type MarketProduct } from "@/lib/services/marketplace";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const params = await searchParams;
  const completedPurchase = params.done ?? null;

  let user;
  let catalog: MarketProduct[];
  let checkoutEnabled = false;

  try {
    user = await requireCapability("export.run");
    catalog = await listProducts();
    checkoutEnabled = true;
  } catch (e) {
    const { errorToResponse, UnauthorizedError } = await import("@/lib/auth/rbac");
    if (e instanceof UnauthorizedError) {
      user = null;
      catalog = [];
      checkoutEnabled = false;
    } else {
      const mapped = errorToResponse(e);
      return (
        <AppShell crumb="/marketplace/cart" title="Cart">
          <p className="text-sm text-compromised">{mapped.body.error}</p>
        </AppShell>
      );
    }
  }

  let items: CartItem[] = [];
  try {
    // Read the cart cookie directly — same cookie /api/marketplace/cart-state
    // reads and writes. (A relative-URL fetch() from a server component does
    // not work, so the previous attempt here always failed and the page
    // showed an empty cart even when the cookie held items.)
    const store = await cookies();
    const raw = store.get("smx_marketplace_cart")?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as CartItem[];
      if (Array.isArray(parsed)) items = parsed.slice(0, 20);
    }
  } catch {
    // No persisted cart state yet — start empty.
  }

  // Re-price cart lines from the current catalog so the displayed total
  // always matches what demo checkout will charge (the cookie cart may hold
  // stale prices from before pricing existed).
  const pricedItems: CartItem[] = items.map((i) => {
    const product = catalog.find((p) => p.id === i.productId);
    return product ? { ...i, name: product.name, priceCents: product.priceCents } : i;
  });
  const { items: valid, totalCents } = finalizeCart(pricedItems);
  const totalPrice = totalCents / 100;

  return (
    <AppShell crumb="/marketplace/cart" title="Cart">
      {completedPurchase ? (
        <Card className="card-lift border border-ready/40" ariaLabel="Demo purchase complete">
          <CardLabel>Demo purchase completed</CardLabel>
          <p className="text-sm text-ready">
            Demo order <span className="font-mono">{completedPurchase}</span> completed.
            No payment was processed.
          </p>
          <LinkButton href="/marketplace/cart" variant="ghost" className="mt-2">
            Return to cart
          </LinkButton>
        </Card>
      ) : null}

      <p className="mb-4 text-sm text-muted">
        Review your demo purchase package(s) below.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {valid.length === 0 ? (
            <Card ariaLabel="Cart is empty">
              <CardLabel>Cart</CardLabel>
              <p className="text-sm text-muted">Your cart is empty.</p>
              <LinkButton href="/marketplace" className="mt-2">
                Browse marketplace
              </LinkButton>
            </Card>
          ) : (
            <Card ariaLabel="Cart items">
              <CardLabel>Cart</CardLabel>
              <ul className="flex flex-col gap-2">
                {valid.map((i) => {
                  const product = catalog.find((p) => p.id === i.productId);
                  return (
                    <li
                      key={i.productId}
                      className="flex items-start justify-between gap-3 border border-edge/60 rounded-md bg-panel-2 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {product?.tag ? <Tag label={product.tag} /> : null}
                          <span className="truncate text-sm font-semibold">{i.name}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted truncate">
                          {product?.sourceLabel ? `${product.sourceLabel} · ` : ""}
                          {i.priceCents === 0 ? "Demo — no charge" : `$${(i.priceCents / 100).toFixed(2)} each`}
                        </p>
                      </div>
                      <div className="text-right tabular text-sm font-semibold">
                        {i.priceCents === 0 ? "$0.00" : `$${((i.priceCents * i.quantity) / 100).toFixed(2)}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 border-t border-edge pt-3 flex items-center justify-between">
                <span className="text-sm text-muted">{valid.length} item{valid.length === 1 ? "" : "s"}</span>
                <span className="tabular font-semibold">
                  {totalPrice === 0 ? "Demo total: $0.00" : `Demo total: $${totalPrice.toFixed(2)}`}
                </span>
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          {checkoutEnabled ? (
            <Card>
              <CardLabel>Demo checkout</CardLabel>
              <CheckoutIsland items={valid} totalCents={totalCents} />
              <LinkButton href="/marketplace" variant="ghost" className="mt-3 w-full">
                Continue browsing
              </LinkButton>
            </Card>
          ) : (
            <Card>
              <CardLabel>Demo checkout</CardLabel>
              <p className="text-sm text-muted">
                Sign in with a role that includes export capability to complete a demo purchase.
              </p>
              <LinkButton href="/login" className="mt-2 w-full">
                Sign in
              </LinkButton>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
