import { prisma } from "@/lib/prisma";
import { METRIC_CATALOG, type MetricKey } from "@/lib/scoring/config";
import { createHash } from "node:crypto";
import { audit } from "@/lib/services/audit";
import type { Prisma } from "@prisma/client";

/**
 * CSV ingestion (spec §14): real validation, row-level errors, duplicate
 * detection, persisted ImportJob with summary + error download.
 */

export interface CsvRow {
  externalId: string;
  timestamp: string;
  type: string;
  value: string;
  unit?: string;
}

export interface RowError {
  row: number;
  reason: string;
  detail: string;
}

export interface ImportSummary {
  jobId: string;
  fileName: string;
  status: "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: RowError[];
}

/** Minimal RFC-4180-ish CSV parser (handles quoted commas). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

const HEADER_MAP: Record<string, keyof CsvRow> = {
  athleteid: "externalId",
  "external id": "externalId",
  externalid: "externalId",
  timestamp: "timestamp",
  date: "timestamp",
  metric: "type",
  type: "type",
  value: "value",
  unit: "unit",
};

export async function importCsv(
  csvText: string,
  fileName: string,
  dataSourceName: string,
  userId: string,
): Promise<ImportSummary> {
  const dataSource = await prisma.dataSource.findUnique({ where: { name: dataSourceName } });
  if (!dataSource) {
    throw new Error(`Data source "${dataSourceName}" not found.`);
  }

  const parsed = parseCsv(csvText);
  if (!parsed) {
    const job = await prisma.importJob.create({
      data: {
        dataSourceId: dataSource.id,
        fileName,
        status: "FAILED",
        log: { summary: "Empty or unreadable CSV." } as unknown as Prisma.InputJsonValue,
        importedBy: userId,
      },
      select: { id: true },
    });
    return {
      jobId: job.id, fileName, status: "FAILED",
      totalRows: 0, processedRows: 0, errorRows: 0,
      errors: [{ row: 0, reason: "EMPTY_FILE", detail: "No data rows found." }],
    };
  }

  const { headers, rows } = parsed;
  const colIdx: Partial<Record<keyof CsvRow, number>> = {};
  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h.toLowerCase().trim()];
    if (mapped && colIdx[mapped] === undefined) colIdx[mapped] = i;
  });
  const missingCols = (["externalId", "timestamp", "type", "value"] as const).filter((k) => colIdx[k] === undefined);

  const errors: RowError[] = [];
  const validRows: { athleteId: string; timestamp: Date; type: MetricKey; value: number; unit: string | null; hash: string }[] = [];
  const seen = new Set<string>();

  if (missingCols.length > 0) {
    errors.push({ row: 0, reason: "SCHEMA_MISMATCH", detail: `Missing required columns: ${missingCols.join(", ")}. Expected headers: externalId, timestamp, type, value[, unit].` });
  } else {
    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 2; // 1-based incl. header
      const cells = rows[i];
      const get = (k: keyof CsvRow): string => (colIdx[k] !== undefined ? (cells[colIdx[k] as number] ?? "").trim() : "");
      const externalId = get("externalId");
      const timestampStr = get("timestamp");
      const type = get("type").toUpperCase();
      const valueStr = get("value");
      const unit = get("unit") || null;

      if (!externalId) { errors.push({ row: rowNo, reason: "MISSING_ATHLETE", detail: "externalId is empty." }); continue; }
      const athlete = await prisma.athlete.findUnique({ where: { externalId }, select: { id: true } });
      if (!athlete) { errors.push({ row: rowNo, reason: "UNKNOWN_ATHLETE", detail: `No athlete with externalId "${externalId}".` }); continue; }

      const ts = new Date(timestampStr);
      if (Number.isNaN(ts.getTime())) { errors.push({ row: rowNo, reason: "BAD_TIMESTAMP", detail: `"${timestampStr}" is not a valid ISO timestamp.` }); continue; }

      const catalog = (METRIC_CATALOG as Record<string, { unit: string; min: number; max: number }>)[type];
      if (!catalog) { errors.push({ row: rowNo, reason: "UNKNOWN_METRIC", detail: `"${type}" is not in the frozen metric catalog.` }); continue; }

      const value = Number(valueStr);
      if (valueStr === "" || Number.isNaN(value)) { errors.push({ row: rowNo, reason: "BAD_VALUE", detail: `"${valueStr}" is not numeric.` }); continue; }
      if (value < catalog.min || value > catalog.max) { errors.push({ row: rowNo, reason: "OUT_OF_RANGE", detail: `${type}=${value} outside catalog range [${catalog.min}, ${catalog.max}].` }); continue; }
      if (unit && unit !== catalog.unit) { errors.push({ row: rowNo, reason: "UNIT_MISMATCH", detail: `${type} expects "${catalog.unit}", got "${unit}".` }); continue; }

      const hash = createHash("sha256").update(`${externalId}|${type}|${ts.toISOString()}|${value}`).digest("hex").slice(0, 32);
      if (seen.has(hash)) { errors.push({ row: rowNo, reason: "DUPLICATE_ROW", detail: "Duplicate of an earlier row in this file." }); continue; }
      seen.add(hash);

      // Cross-file duplicate detection against existing observations.
      const existing = await prisma.observation.findFirst({
        where: { athleteId: athlete.id, type, timestamp: ts, value },
        select: { id: true },
      });
      if (existing) { errors.push({ row: rowNo, reason: "DUPLICATE_EXISTING", detail: "Identical observation already persisted." }); continue; }

      validRows.push({ athleteId: athlete.id, timestamp: ts, type: type as MetricKey, value, unit, hash });
    }
  }

  // Persist valid observations (keep provenance: source = CSV Import).
  const chunk = 1000;
  for (let i = 0; i < validRows.length; i += chunk) {
    await prisma.observation.createMany({
      data: validRows.slice(i, i + chunk).map((r) => ({
        athleteId: r.athleteId,
        dataSourceId: dataSource.id,
        timestamp: r.timestamp,
        type: r.type,
        value: r.value,
        unit: r.unit,
        isValid: true,
        metadata: { source: "CSV_IMPORT", importHash: r.hash, signalQuality: 0.9 },
      })),
    });
  }

  const status: ImportSummary["status"] =
    validRows.length === 0 && rows.length > 0 ? "FAILED" : errors.length > 0 ? "PARTIAL_SUCCESS" : "COMPLETED";

  const job = await prisma.importJob.create({
    data: {
      dataSourceId: dataSource.id,
      fileName,
      status,
      totalRows: rows.length,
      processedRows: validRows.length,
      errorRows: errors.length,
      log: {
        summary:
          status === "COMPLETED"
            ? `All ${validRows.length} rows imported.`
            : status === "PARTIAL_SUCCESS"
              ? `${validRows.length} imported, ${errors.length} rejected.`
              : `Import failed: ${errors.length} problems.`,
        errors: errors.slice(0, 200),
      } as unknown as Prisma.InputJsonValue,
      importedBy: userId,
    },
    select: { id: true },
  });

  await audit({
    userId,
    action: "IMPORT_COMPLETED",
    entityType: "ImportJob",
    entityId: job.id,
    newValue: { fileName, status, totalRows: rows.length, processedRows: validRows.length, errorRows: errors.length },
  });

  return {
    jobId: job.id,
    fileName,
    status,
    totalRows: rows.length,
    processedRows: validRows.length,
    errorRows: errors.length,
    errors: errors.slice(0, 100),
  };
}
