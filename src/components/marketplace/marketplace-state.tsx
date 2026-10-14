"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { MarketProduct } from "@/lib/services/marketplace";

export interface MarketplaceFilters {
  query: string;
  tag: string | null;
  available: boolean | null;
  dataType: string | null;
  sort: "name" | "score" | "tag" | "price" | "newest";
}

export interface MarketplaceState {
  filters: MarketplaceFilters;
  setFilters: (filters: MarketplaceFilters) => void;
}

const EMPTY_filters: MarketplaceFilters = {
  query: "",
  tag: null,
  available: null,
  dataType: null,
  sort: "name",
};

const MarketplaceContext = createContext<MarketplaceState | null>(null);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<MarketplaceFilters>(EMPTY_filters);

  return (
    <MarketplaceContext.Provider value={{ filters, setFilters }}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace(): MarketplaceState {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error("useMarketplace must be used within MarketplaceProvider");
  return ctx;
}

export function filteredProducts(products: MarketProduct[], filters: MarketplaceFilters): MarketProduct[] {
  let list = [...products];

  if (filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.sourceLabel.toLowerCase().includes(q),
    );
  }

  if (filters.tag) {
    list = list.filter((p) => p.tag === filters.tag);
  }

  if (filters.available === true) {
    list = list.filter((p) => p.available);
  } else if (filters.available === false) {
    list = list.filter((p) => !p.available);
  }

  if (filters.dataType) {
    list = list.filter((p) => dataTypeLabel(p) === filters.dataType);
  }

  list = [...list].sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "score") return (b.priceCents - a.priceCents) || a.name.localeCompare(b.name);
    if (filters.sort === "tag") return a.tag.localeCompare(b.tag) || a.name.localeCompare(b.name);
    if (filters.sort === "price") return a.priceCents - b.priceCents || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });

  return list;
}

export function dataTypeLabel(product: MarketProduct): string {
  const lower = product.name.toLowerCase();
  if (lower.includes("roster") || lower.includes("team")) return "Roster";
  if (lower.includes("session") || lower.includes("workload") || lower.includes("practice")) return "Sessions / Workload";
  if (lower.includes("recovery") || lower.includes("hrv") || lower.includes("sleep")) return "Recovery";
  if (lower.includes("environment") || lower.includes("travel") || lower.includes("heat") || lower.includes("aqi")) return "Environment & Travel";
  if (lower.includes("athlete") || lower.includes("player")) return "Per-Athlete";
  if (lower.includes("import") || lower.includes("job") || lower.includes("csv")) return "Import Job";
  return "Other";
}
