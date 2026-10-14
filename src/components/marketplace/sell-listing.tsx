"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel, Tag, Button } from "@/components/ui/primitives";

/**
 * "Sell / list" tab — create locally-stored, synthetic-only listing cards.
 *
 * HONESTY RULE (matches the reference demo): no listing is transmitted to the
 * server. Browser localStorage holds only the listing metadata typed here.
 * Local listings are visible only in this browser and are NOT checkout
 * eligible (demo checkout re-prices from the server catalog only).
 */

const LISTINGS_KEY = "smx_marketplace_listings";

export interface LocalListing {
  id: string;
  title: string;
  sport: string;
  category: string;
  description: string;
  source: string;
  priceUsd: number;
  terms: string;
  createdAt: string;
}

const SPORT_OPTIONS = ["Football", "Basketball", "Cycling", "Running", "Other"];
const CATEGORY_OPTIONS = ["Performance", "Recovery", "Environment", "Workload", "Other"];

function readListings(): LocalListing[] {
  try {
    const raw = window.localStorage.getItem(LISTINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalListing[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeListings(listings: LocalListing[]) {
  window.localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
}

export function SellListing() {
  const [listings, setListings] = useState<LocalListing[]>([]);
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState(SPORT_OPTIONS[0]);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [priceUsd, setPriceUsd] = useState(25);
  const [terms, setTerms] = useState("Research only · cohort-level use");
  const [syntheticOnly, setSyntheticOnly] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  // Hydrate after mount to avoid SSR/localStorage mismatches.
  useEffect(() => {
    setListings(readListings());
  }, []);

  const canCreate = syntheticOnly && title.trim().length > 0;

  function createListing() {
    if (!canCreate) return;
    const listing: LocalListing = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      sport,
      category,
      description: description.trim(),
      source: source.trim() || "Unspecified provenance",
      priceUsd: Number.isFinite(priceUsd) && priceUsd >= 0 ? priceUsd : 0,
      terms: terms.trim() || "No terms stated",
      createdAt: new Date().toISOString(),
    };
    const next = [listing, ...readListings()];
    writeListings(next);
    setListings(next);
    setTitle("");
    setDescription("");
    setSource("");
    setSyntheticOnly(false);
    setCreated(listing.id);
  }

  function removeListing(id: string) {
    const next = readListings().filter((l) => l.id !== id);
    writeListings(next);
    setListings(next);
    if (created === id) setCreated(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="card-lift" ariaLabel="List a dataset">
          <CardLabel>Contribute responsibly</CardLabel>
          <h2 className="display-heading text-xl">List a dataset</h2>
          <p className="mt-1 text-sm text-muted">
            Create a locally stored, synthetic listing card. This demo cannot accept or transfer
            real data, payments, or licenses.
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
                placeholder="Describe a fictional sample and its intended cohort-level use."
                className="rounded-md border border-edge bg-panel-2 px-3 py-2 text-sm placeholder:text-muted focus:border-accent"
              />
            </label>

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

            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={syntheticOnly}
                onChange={(e) => setSyntheticOnly(e.target.checked)}
                className="mt-0.5"
              />
              <span>This listing contains only synthetic/demo records</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={createListing} disabled={!canCreate}>
                + Create local listing
              </Button>
              {!canCreate ? (
                <span className="text-xs text-muted">
                  Requires a title and the synthetic-records confirmation.
                </span>
              ) : null}
            </div>

            <p className="text-xs text-muted">
              Never enter real personal or health data. Listing metadata is stored locally in this
              browser only; uploaded records are not transmitted anywhere.
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
            No listing is transmitted. Browser storage contains only listing metadata you enter.
            Use fictional descriptions only.
          </p>
        </Card>
      </div>

      <div className="lg:col-span-3">
        {listings.length > 0 ? (
          <Card ariaLabel="My local listings">
            <div className="flex items-center justify-between">
              <CardLabel>My local listings</CardLabel>
              <span className="text-xs text-muted">{listings.length} stored in this browser</span>
            </div>
            <ul className="mt-3 grid gap-2">
              {listings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-edge/60 bg-panel-2 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag label="LOCAL" />
                      <span className="text-xs text-muted">{l.sport} · {l.category}</span>
                      {created === l.id ? (
                        <span className="rounded-full border border-ready/40 bg-ready/10 px-2 py-0.5 text-[11px] font-semibold text-ready">
                          Created
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-ink">{l.title}</h3>
                    {l.description ? (
                      <p className="mt-0.5 truncate text-xs text-muted">{l.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      Provenance: {l.source} · Terms: {l.terms}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="tabular text-sm font-semibold text-accent">
                      ${l.priceUsd.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-muted">View-only · not checkout eligible</span>
                    <Button
                      variant="danger"
                      onClick={() => removeListing(l.id)}
                      className="text-xs"
                      aria-label={`Remove local listing ${l.title}`}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}