import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { CartItem } from "@/lib/services/marketplace";

const CART_COOKIE = "smx_marketplace_cart";
const MAX_ITEMS = 20;

function decode(value: string): CartItem[] {
  try {
    const parsed = JSON.parse(value) as CartItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function encode(items: CartItem[]): string {
  return JSON.stringify(items.slice(0, MAX_ITEMS));
}

export async function GET() {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  const items = raw ? decode(raw) : [];
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  const current = raw ? decode(raw) : [];

  let next: CartItem[];
  try {
    const body = (await request.json()) as { items?: CartItem[] };
    if (Array.isArray(body.items)) {
      next = body.items;
    } else {
      next = current;
    }
  } catch {
    next = current;
  }

  store.set(CART_COOKIE, encode(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ items: next });
}
