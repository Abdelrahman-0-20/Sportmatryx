import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, errorToResponse } from "@/lib/auth/rbac";
import { audit } from "@/lib/services/audit";
import { PUBLISHED_STATUS, MAX_PUBLIC_LISTINGS } from "@/lib/marketplace/listings";

/**
 * GET /api/marketplace/listings — public list of published seller listings.
 *
 * No authentication required: anyone browsing the marketplace can see what
 * other users are selling. Photos are stored separately in the
 * market_product_images table keyed by listing id (see /api/marketplace/images).
 */
export async function GET() {
  try {
    const listings = await prisma.marketListing.findMany({
      where: { status: PUBLISHED_STATUS },
      orderBy: { createdAt: "desc" },
      take: MAX_PUBLIC_LISTINGS,
      select: {
        id: true,
        title: true,
        sport: true,
        category: true,
        description: true,
        source: true,
        priceUsd: true,
        terms: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ listings }, { status: 200 });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

/**
 * POST /api/marketplace/listings — publish a seller listing.
 *
 * Signed-in users only (guests can browse but cannot publish). Input is
 * validated before touching the database; every publish is recorded in the
 * tamper-evident audit log.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as {
      title?: string;
      sport?: string;
      category?: string;
      description?: string;
      source?: string;
      priceUsd?: number;
      terms?: string;
    };

    const title = (body.title ?? "").trim();
    const sport = (body.sport ?? "Other").trim() || "Other";
    const category = (body.category ?? "Other").trim() || "Other";
    const description = (body.description ?? "").trim();
    const source = (body.source ?? "Unspecified provenance").trim() || "Unspecified provenance";
    const terms = (body.terms ?? "No terms stated").trim() || "No terms stated";
    const priceUsd = body.priceUsd ?? 0;

    // Validation — reject before touching the database.
    if (title.length < 3 || title.length > 120) {
      return NextResponse.json(
        { error: "Title must be 3–120 characters.", code: "INVALID_TITLE" },
        { status: 400 },
      );
    }
    if (description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be at most 2000 characters.", code: "INVALID_DESCRIPTION" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 100_000) {
      return NextResponse.json(
        { error: "Price must be between $0.00 and $100,000.00.", code: "INVALID_PRICE" },
        { status: 400 },
      );
    }
    if (terms.length > 500) {
      return NextResponse.json(
        { error: "Terms must be at most 500 characters.", code: "INVALID_TERMS" },
        { status: 400 },
      );
    }

    const listing = await prisma.marketListing.create({
      data: {
        sellerId: user.id,
        title,
        sport,
        category,
        description,
        source,
        priceUsd,
        terms,
        status: PUBLISHED_STATUS,
      },
      select: { id: true, title: true, createdAt: true },
    });

    await audit({
      userId: user.id,
      action: "MARKETPLACE_LISTING_PUBLISHED",
      entityType: "MarketListing",
      entityId: listing.id,
      newValue: { title: listing.title, priceUsd },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}