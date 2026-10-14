import { prisma } from "@/lib/prisma";
import { withFallback } from "@/lib/offline";
import { audit } from "./audit";
import type { SessionUser } from "@/lib/auth/session";
import { demoPriceCents, formatUsdCents } from "@/lib/marketplace/demo-pricing";

/**
 * Marketplace — purchasable data-product catalog derived from existing import
 * jobs and CSV ingestion already present in the application.
 *
 * HONESTY RULE (spec §25): every product is explicitly labeled demo/sample
 * where it represents synthetic data. No real-payment processing here.
 */

export interface MarketProduct {
  id: string;
  name: string;
  description: string;
  sourceLabel: string; // e.g. "Existing import job" / "Sample dataset"
  sourceRef: string | null; // import job id or "sample"
  priceCents: number; // DEMO price only
  currency: string;
  rowsEstimate: number | null;
  includes: string[];
  tag: string; // PROTOTYPE / ESTABLISHED / SAMPLE
  available: boolean;
  // Demo highlight flags (additive). `featured` marks the demo's flagship
  // device package; claims are scoped to this demo only.
  featured?: boolean;
  featuredNote?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface DemoPurchase {
  purchaseId: string;
  demo: true;
  items: CartItem[];
  totalCents: number;
  status: "DEMONSTRATED";
  note: string;
}

const DEMO_TAG = "SAMPLE";

/**
 * Build the purchasable catalog from existing import jobs plus a small set of
 * explicitly-labeled sample products so the marketplace is never empty.
 */
export async function listProducts(): Promise<MarketProduct[]> {
  return withFallback(
    () => queryProducts(),
    () => sampleProducts(),
  );
}

async function queryProducts(): Promise<MarketProduct[]> {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    where: { status: { in: ["COMPLETED", "PARTIAL_SUCCESS"] } },
  });

  const fromJobs: MarketProduct[] = jobs.map((j) => ({
    id: `job-${j.id}`,
    name: `Import package — ${j.fileName ?? "import"}`,
    description: `Dataset from import job ${j.id}. ${j.status === "COMPLETED" ? "Fully processed." : "Partially processed — review errors before use."}`,
    sourceLabel: "Existing import job",
    sourceRef: j.id,
    priceCents: demoPriceCents(`job-${j.id}`),
    currency: "USD",
    rowsEstimate: j.totalRows ?? j.processedRows ?? null,
    includes: [
      "Validated observation rows from the uploaded CSV",
      "Row-level error report where present",
      "Import job metadata",
    ],
    tag: j.status === "COMPLETED" ? "ESTABLISHED" : "PROTOTYPE",
    available: true,
  }));

  // Deduplicate by fileName where present, keep newest
  const byName = new Map<string, MarketProduct>();
  for (const p of fromJobs) {
    const key = p.name;
    if (!byName.has(key) || (p.sourceRef && p.sourceRef !== byName.get(key)!.sourceRef)) {
      byName.set(key, p);
    }
  }

  return [...byName.values(), ...sampleProducts()];
}

export function sampleProducts(): MarketProduct[] {
  return [
    {
      id: "sample-facebit",
      name: "FaceBit smart mask — respiratory & vitals package (demo)",
      description: "The flagship device package in this demo. FaceBit is a small sensor that clips inside a face mask and captures respiratory rate, heart rate, mask fit and wear-time alongside workload context — the highest signal-density package shown here. Synthetic sample data — not real athlete data.",
      sourceLabel: "Featured device",
      sourceRef: "sample",
      priceCents: 5900,
      currency: "USD",
      rowsEstimate: 400,
      includes: [
        "Respiratory rate & heart-rate streams (synthetic)",
        "Mask fit / wear-time sessions (synthetic)",
        "Workload context join (synthetic)",
        "Device calibration snapshot (synthetic)",
      ],
      tag: "SAMPLE",
      available: true,
      featured: true,
      featuredNote: "Best in demo — presented as the most effective device package in this demonstration only.",
    },
    {
      id: "sample-roster",
      name: "Team roster summary package",
      description: "A demo roster export package: athlete identifiers, positions and readiness band snapshot. Synthetic sample data — not real athlete data.",
      sourceLabel: "Sample dataset",
      sourceRef: "sample",
      priceCents: demoPriceCents("sample-roster"),
      currency: "USD",
      rowsEstimate: 50,
      includes: [
        "Roster snapshot (synthetic)",
        "Position grouping",
        "Readiness band summary",
      ],
      tag: "SAMPLE",
      available: true,
    },
    {
      id: "sample-sessions",
      name: "Session workload package (demo)",
      description: "A demo package of practice and game session context with load observations. Synthetic sample data — not real athlete data.",
      sourceLabel: "Sample dataset",
      sourceRef: "sample",
      priceCents: demoPriceCents("sample-sessions"),
      currency: "USD",
      rowsEstimate: 200,
      includes: [
        "Session list (synthetic)",
        "Drill / repetition context",
        "Load observations (synthetic)",
      ],
      tag: "SAMPLE",
      available: true,
    },
    {
      id: "sample-recovery",
      name: "Recovery & environment package (demo)",
      description: "A demo package of HRV, resting heart rate, sleep and environment/travel exposure observations. Synthetic sample data — not real athlete data.",
      sourceLabel: "Sample dataset",
      sourceRef: "sample",
      priceCents: demoPriceCents("sample-recovery"),
      currency: "USD",
      rowsEstimate: 300,
      includes: [
        "Recovery observations (synthetic)",
        "Environment & travel exposure (synthetic)",
        "Staleness summary",
      ],
      tag: "SAMPLE",
      available: true,
    },
  ];
}

/**
 * Validate a cart and return the finalized line items + total.
 */
export function finalizeCart(items: CartItem[]): { items: CartItem[]; totalCents: number } {
  const valid = items
    .filter((i) => i.quantity > 0 && i.priceCents >= 0)
    .map((i) => ({ ...i }));
  const totalCents = valid.reduce((a, i) => a + i.priceCents * i.quantity, 0);
  return { items: valid, totalCents };
}

/**
 * DEMO checkout — no payment processing.
 * Writes a clearly-labeled demo purchase + audit entry for the current user.
 */
export async function demoCheckout(
  user: SessionUser,
  items: CartItem[],
): Promise<DemoPurchase> {
  const { items: valid, totalCents } = finalizeCart(items);
  if (valid.length === 0) {
    throw new Error("Cart is empty.");
  }

  const purchaseId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const note = `Demo purchase — no payment processed, no money moved. ${valid.length} item(s), ${formatUsdCents(totalCents)} display-only demo total.`;

  try {
    await audit({
      userId: user.id,
      action: "MARKETPLACE_DEMO_PURCHASE",
      entityType: "MarketplacePurchase",
      entityId: purchaseId,
      newValue: { items: valid, totalCents, currency: "USD", demo: true },
    });
  } catch {
    // Audit is best-effort; a demo purchase still completes.
  }

  return {
    purchaseId,
    demo: true,
    items: valid,
    totalCents,
    status: "DEMONSTRATED",
    note,
  };
}

/**
 * Quick source summary for a product detail page.
 */
export async function productSourceSummary(product: MarketProduct): Promise<{
  sourceLabel: string;
  sourceRef: string | null;
  rowsEstimate: number | null;
  previewRows: { label: string; value: string }[];
}> {
  return withFallback(
    () => querySourceSummary(product),
    () => sampleSourceSummary(product),
  );
}

async function querySourceSummary(product: MarketProduct): Promise<{
  sourceLabel: string;
  sourceRef: string | null;
  rowsEstimate: number | null;
  previewRows: { label: string; value: string }[];
}> {
  if (product.sourceRef && product.sourceRef.startsWith("job-")) {
    const jobId = product.sourceRef.slice(4);
    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return {
        sourceLabel: product.sourceLabel,
        sourceRef: product.sourceRef,
        rowsEstimate: product.rowsEstimate,
        previewRows: [],
      };
    }
    return {
      sourceLabel: "Existing import job",
      sourceRef: job.id,
      rowsEstimate: job.totalRows ?? job.processedRows ?? null,
      previewRows: [
        { label: "File", value: job.fileName ?? "—" },
        { label: "Status", value: job.status },
        { label: "Rows imported", value: `${job.processedRows ?? 0} / ${job.totalRows ?? 0}` },
        { label: "Errors", value: String(job.errorRows ?? 0) },
      ],
    };
  }

  return {
    sourceLabel: product.sourceLabel,
    sourceRef: product.sourceRef,
    rowsEstimate: product.rowsEstimate,
    previewRows: [],
  };
}

function sampleSourceSummary(product: MarketProduct): {
  sourceLabel: string;
  sourceRef: string | null;
  rowsEstimate: number | null;
  previewRows: { label: string; value: string }[];
} {
  return {
    sourceLabel: product.sourceLabel,
    sourceRef: product.sourceRef,
    rowsEstimate: product.rowsEstimate,
    previewRows: product.sourceRef === "sample"
      ? [
          { label: "Type", value: "Synthetic sample dataset" },
          { label: "Rows (approx.)", value: String(product.rowsEstimate ?? 0) },
          { label: "Provenance", value: "Demo / offline sample data" },
        ]
      : [],
  };
}
