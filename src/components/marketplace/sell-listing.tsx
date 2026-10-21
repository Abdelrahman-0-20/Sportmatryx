"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel, Tag, Button } from "@/components/ui/primitives";
import { ListingImages } from "./listing-images";
import { MAX_LISTING_FILES, ListingFiles, type ListingFile } from "./listing-files";

/**
 * "Sell / list" tab — publish a listing to the app database.
 *
 * HONESTY RULE: this is still a DEMO marketplace. Listings are stored in the
 * database and visible to everyone (CommunityListings section), but checkout
 * remains a demo flow with no real payment and no money moved. Guests can
 * browse but only signed-in users can publish.
 */

const SPORT_OPTIONS = ["Football", "Basketball", "Cycling", "Running", "Other"];
const CATEGORY_OPTIONS = ["Performance", "Recovery", "Environment", "Workload", "Other"];

export function SellListing() {
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState(SPORT_OPTIONS[0]);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [priceUsd, setPriceUsd] = useState(25);
  const [terms, setTerms] = useState("Research only · cohort-level use");
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<ListingFile[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  const canCreate = title.trim().length >= 3;

  async function publish() {
    if (!canCreate || publishing) return;
    setPublishing(true);
    setError(null);
    setPublished(null);
    try {
      const res = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sport,
          category,
          description: description.trim(),
          source: source.trim() || "Unspecified provenance",
          priceUsd: Number.isFinite(priceUsd) && priceUsd >= 0 ? priceUsd : 0,
          terms: terms.trim() || "No terms stated",
        }),
      });
      if (res.status === 401) {
        setError("Sign in required to publish — guests can browse but cannot list.");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Publish failed.");
        return;
      }
      const { listing } = (await res.json()) as { listing: { id: string } };

      // Upload selected photos, keyed to the new listing id.
      let uploaded = 0;
      let failed = 0;
      for (const dataUrl of images.slice(0, 6)) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `listing-photo-${uploaded + 1}.jpg`, {
            type: blob.type || "image/jpeg",
          });
          const fd = new FormData();
          fd.set("productKey", listing.id);
          fd.append("files", file);
          const up = await fetch("/api/marketplace/images", { method: "POST", body: fd });
          if (up.ok) uploaded++;
          else failed++;
        } catch {
          failed++;
        }
      }

      setPublished(listing.id);
      setTitle("");
      setDescription("");
      setSource("");
      setPriceUsd(25);
      setTerms("Research only · cohort-level use");
      setImages([]);
      setFiles([]);
      // Keep files note: data files stay browser-local (not uploaded) in this demo.
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="card-lift" ariaLabel="List a dataset">
          <CardLabel>Contribute responsibly</CardLabel>
          <h2 className="display-heading text-xl">List a dataset</h2>
          <p className="mt-1 text-sm text-muted">
            Publish a listing to the platform database — it appears in the marketplace for all
            visitors. This is a demo: no payments, no money moved.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">Listing title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Synthetic interval session sample"
                className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Sport</span>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
                >
                  {SPORT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your synthetic sample and its intended cohort-level use."
                className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent"
              />
            </label>

            <ListingImages value={images} onChange={setImages} />
            <ListingFiles value={files} onChange={setFiles} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Source / provenance</span>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Synthetic sensor protocol"
                  className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Demo license price ($)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.valueAsNumber)}
                  className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">Plain-language use terms</span>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm focus:border-accent"
              />
            </label>

            {error ? (
              <p role="alert" className="text-sm text-compromised">{error}</p>
            ) : null}

            {published ? (
              <p role="status" className="text-sm text-ready">
                Published ✓ — your listing is now live in the marketplace. Attached photos are
                stored in the database; data files (if any) stay in this browser only in this demo.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={publish} disabled={!canCreate || publishing}>
                {publishing ? "Publishing…" : "Publish listing"}
              </Button>
              {!canCreate ? (
                <span className="text-xs text-muted">Requires a title of at least 3 characters.</span>
              ) : null}
            </div>

            <p className="text-xs text-muted">
              Never enter real personal or health data. Synthetic demo records only. Checkout is a
              demo flow — no payment is processed.
            </p>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="card-lift border border-accent/40" ariaLabel="Before you list">
          <CardLabel>Before you list</CardLabel>
          <dl className="grid gap-2.5 text-sm">
            {[
              ["Consent", "Document permission for the stated audience and purpose."],
              ["De-identification", "Remove direct identifiers and assess re-identification risk."],
              ["Provenance", "Name sensors, units, collection setting and known limitations."],
              ["License", "State permitted uses, attribution and onward-sharing rules."],
            ].map(([label, text]) => (
              <div key={label} className="border-b border-edge/60 pb-2">
                <dt className="font-semibold text-ink">{label}</dt>
                <dd className="mt-0.5 text-xs text-muted">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Published listings are stored in the app database and shown to all visitors. Use
            fictional descriptions only.
          </p>
        </Card>
      </div>
    </div>
  );
}