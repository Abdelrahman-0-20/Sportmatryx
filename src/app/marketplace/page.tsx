import { AppShell } from "@/components/ui/app-shell";
import { MarketplaceListing } from "@/components/marketplace/listing";
import { requireReadForGuest } from "@/lib/offline";
import { listProducts, type MarketProduct } from "@/lib/services/marketplace";

export const dynamic = "force-dynamic";

/**
 * Marketplace listing.
 * Browseable by guest; checkout requires a real session (demo purchase).
 */
export default async function MarketplacePage() {
  let products: MarketProduct[];
  try {
    await requireReadForGuest("roster.read");
    products = await listProducts();
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

  return (
    <AppShell crumb="/marketplace" title="Marketplace">
      <p className="mb-4 text-sm text-muted">
        Browse purchasable data-product packages derived from existing import jobs and demo datasets.
        Demo checkout only — no payment processing.
      </p>

      <MarketplaceListing products={products} />
    </AppShell>
  );
}
