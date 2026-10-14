import { NextResponse } from "next/server";
import { requireCapability, UnauthorizedError, errorToResponse } from "@/lib/auth/rbac";
import { demoCheckout, finalizeCart, listProducts, type CartItem } from "@/lib/services/marketplace";

/**
 * POST /api/marketplace/checkout — DEMO checkout only.
 *
 * Authenticated users only. No payment processing; records a clearly-labeled
 * demo purchase + audit entry.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCapability("export.run");
    const body = (await request.json()) as {
      items?: { productId?: string; quantity?: number }[];
      email?: string;
      name?: string;
    };

    const items = (body.items ?? []).map((i): CartItem => ({
      productId: i.productId ?? "",
      name: "",
      priceCents: 0,
      quantity: i.quantity ?? 0,
    }));

    const catalog = await listProducts();
    const priced: CartItem[] = items
      .filter((i) => i.productId && i.quantity > 0)
      .map((i) => {
        const product = catalog.find((p) => p.id === i.productId);
        if (!product) throw new Error(`Unknown product: ${i.productId}`);
        return { ...i, name: product.name, priceCents: product.priceCents };
      });

    const { items: valid, totalCents } = finalizeCart(priced);
    if (valid.length === 0) {
      return NextResponse.json({ error: "Cart is empty.", code: "EMPTY_CART" }, { status: 400 });
    }

    const purchase = await demoCheckout(user, valid);
    return NextResponse.json(purchase, { status: 200 });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Sign in to complete a demo purchase.", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
