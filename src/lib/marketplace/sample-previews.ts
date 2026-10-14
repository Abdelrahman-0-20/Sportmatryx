import type { MarketProduct } from "@/lib/services/marketplace";

/**
 * Generate a small labeled sample CSV preview for a marketplace product.
 *
 * HONESTY RULE (spec §25): these are SYNTHETIC SAMPLE previews only.
 * They are clearly labeled inside the CSV and the UI, and never
 * presented as real athlete data.
 */

export function samplePreviewCsv(product: MarketProduct): string {
  const header = [
    "// Sportmetryx Football — demo product sample preview",
    `// Product: ${product.name} (${product.id})`,
    "// Source: synthetic sample / demo dataset — not real athlete data",
    `// Rows shown: sample preview (not the full package)`,
    "",
  ].join("\n");

  const rows = sampleRowsForProduct(product);
  return header + rows.join("\n") + "\n";
}

export function samplePreviewFileName(product: MarketProduct): string {
  const safe = product.name.replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase();
  return `smx-demo-${safe || "product"}-preview.csv`;
}

export function samplePreviewNote(product: MarketProduct): string {
  return `Synthetic sample preview for "${product.name}". This is a demo download only — not real athlete data.`;
}

function sampleRowsForProduct(product: MarketProduct): string[] {
  const lower = product.name.toLowerCase();

  if (lower.includes("roster") || lower.includes("team")) {
    return [
      "externalId,displayName,position,positionGroup,band,score,confidence",
      "EC-10,Calhoun E.,SKILL,SKILL,READY,81.4,94",
      "EC-07,Jennings J.,TRENCH,TRENCH,MONITOR,58.2,88",
      "EC-64,Reyes D.,LB_TE,LB_TE,READY,75.0,91",
    ];
  }

  if (lower.includes("session") || lower.includes("workload") || lower.includes("practice")) {
    return [
      "athleteId,date,type,drill,durationMinutes,loadAU,venue,temperatureC,aqi",
      "guest-ath-10,2025-10-10T06:30:00Z,PRACTICE,Drill-1,110,8.5,Ironmark Stallions Field,24,18",
      "guest-ath-10,2025-10-10T07:00:00Z,GAME,vs Cross-town Club,180,11.2,Ironmark Stallions Field,26,22",
    ];
  }

  if (lower.includes("recovery") || lower.includes("hrv") || lower.includes("sleep")) {
    return [
      "athleteId,day,type,value,unit,isValid",
      "guest-ath-10,2025-10-10,HRV_MS,86,ms,true",
      "guest-ath-10,2025-10-10,RHR,51,bpm,true",
      "guest-ath-10,2025-10-10,SLEEP_H,7.8,h,true",
    ];
  }

  if (lower.includes("environment") || lower.includes("travel") || lower.includes("heat") || lower.includes("aqi")) {
    return [
      "athleteId,day,type,value,unit",
      "guest-ath-10,2025-10-10,HEAT_C,24,C",
      "guest-ath-10,2025-10-10,AQI,18,Index",
      "guest-ath-10,2025-10-10,TZ_SHIFT_H,0,h",
    ];
  }

  if (lower.includes("athlete") || lower.includes("player")) {
    return [
      "athleteId,externalId,displayName,position,rosterRole,teamName,band,score",
      "guest-ath-10,EC-10,Calhoun E.,SKILL,Starter,Ironmark Stallions,READY,81.4",
    ];
  }

  if (lower.includes("import") || lower.includes("job") || lower.includes("csv")) {
    return [
      "externalId,timestamp,type,value,unit",
      "EC-10,2025-10-10T06:30:00Z,RESP_RATE,15.5,brpm",
      "EC-10,2025-10-10T06:30:00Z,SPO2,98.2,%",
    ];
  }

  return [
    "externalId,timestamp,type,value,unit",
    "EC-10,2025-10-10T06:30:00Z,RESP_RATE,15.5,brpm",
    "EC-10,2025-10-10T06:30:00Z,SPO2,98.2,%",
  ];
}
