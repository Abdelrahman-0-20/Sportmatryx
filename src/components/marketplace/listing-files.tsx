"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/primitives";

/**
 * Sample data-file picker for locally-stored marketplace listings.
 *
 * Supports CSV, Excel (.xlsx/.xls), TSV, JSON and TXT files with an inline
 * preview: spreadsheet-like files are parsed in the browser with SheetJS
 * (xlsx) to show sheet tabs, row/column counts and the first sample rows.
 *
 * HONESTY RULE (matches listing-images.tsx / sell-listing.tsx): files are read
 * in the browser and held in memory/localStorage only. They are never
 * transmitted to any server, and are not checkout eligible.
 */

export const MAX_LISTING_FILES = 5;
const MAX_FILE_BYTES = 300_000; // raw file size cap (base64 inflates ~1.33x)
const ACCEPT = ".csv,.xlsx,.xls,.tsv,.json,.txt";
const PREVIEW_ROWS = 4; // header + 3 data rows
const PREVIEW_COLS = 6;

export type ListingFileKind = "csv" | "excel" | "tsv" | "json" | "text";

export interface ListingFile {
  name: string;
  size: number;
  dataUrl: string;
  kind: ListingFileKind;
  /** Spreadsheet-like files: parsed sheet names (first sheet is previewed). */
  sheets?: string[];
  /** Rows in the first sheet, header included. */
  rows?: number;
  /** Columns in the first sheet. */
  cols?: number;
}

export interface SheetPreview {
  rows: number;
  cols: number;
  head: string[][];
}

/** SheetPreview for tabular files, plain string snippet for text-like files. */
type Preview = SheetPreview | string;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function kindOf(name: string): ListingFileKind | null {
  switch (extOf(name)) {
    case "csv":
      return "csv";
    case "xlsx":
    case "xls":
      return "excel";
    case "tsv":
      return "tsv";
    case "json":
      return "json";
    case "txt":
      return "text";
    default:
      return null;
  }
}

function shortType(name: string): string {
  const ext = extOf(name);
  return ext ? ext.toUpperCase() : "FILE";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Parse sheet names + first-sheet dimensions from a stored dataUrl. */
function workbookMeta(dataUrl: string): { sheets: string[]; rows?: number; cols?: number } | null {
  try {
    const wb = XLSX.read(bytesFromDataUrl(dataUrl), { type: "array" });
    let rows: number | undefined;
    let cols: number | undefined;
    const first = wb.SheetNames[0];
    if (first) {
      const ref = wb.Sheets[first]?.["!ref"];
      if (typeof ref === "string") {
        const range = XLSX.utils.decode_range(ref);
        rows = range.e.r - range.s.r + 1;
        cols = range.e.c - range.s.c + 1;
      }
    }
    return { sheets: wb.SheetNames.slice(), rows, cols };
  } catch {
    return null;
  }
}

/** Parse one sheet of a stored dataUrl into a compact preview table. */
function parseSheet(dataUrl: string, sheetName?: string): SheetPreview | null {
  try {
    const wb = XLSX.read(bytesFromDataUrl(dataUrl), { type: "array" });
    const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
    if (!name) return null;
    const sheet = wb.Sheets[name];
    if (!sheet || typeof sheet["!ref"] !== "string") return null;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown as string[][];
    const head = matrix
      .slice(0, PREVIEW_ROWS)
      .map((row) => row.slice(0, PREVIEW_COLS).map((cell) => String(cell ?? "")));
    return {
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1,
      head,
    };
  } catch {
    return null;
  }
}

function PreviewPanel({ file, preview, activeSheet, onSelectSheet }: {
  file: ListingFile;
  preview: Preview;
  activeSheet?: string;
  onSelectSheet: (sheet: string) => void;
}) {
  if (typeof preview === "string") {
    if (file.kind === "json" || file.kind === "text") {
      return (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-edge/60 bg-panel-2 p-2 text-[11px] leading-relaxed text-muted">
          {preview || "Preview unavailable for this file."}
        </pre>
      );
    }
    return <p className="text-[11px] text-muted">Preview unavailable for this file.</p>;
  }

  return (
    <div className="grid gap-1.5">
      {file.sheets && file.sheets.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {file.sheets.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSelectSheet(s)}
              aria-pressed={s === activeSheet}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                s === activeSheet
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-edge bg-panel-2 text-muted hover:border-accent/40 hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-auto rounded border border-edge/60 bg-panel-2">
        <table className="w-full text-left text-[11px]">
          {preview.head[0] ? (
            <thead>
              <tr>
                {preview.head[0].map((cell, ci) => (
                  <th
                    key={ci}
                    className="max-w-[160px] truncate whitespace-nowrap border-b border-edge/60 px-2 py-1 font-semibold text-ink"
                  >
                    {cell || `Column ${ci + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {preview.head.slice(1).map((row, ri) => (
              <tr key={ri} className="border-b border-edge/30 last:border-b-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="max-w-[160px] truncate whitespace-nowrap px-2 py-1 text-muted"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted">
        {preview.rows} rows × {preview.cols} columns (header included) · preview shows the first{" "}
        {Math.min(preview.head.length, PREVIEW_ROWS)} rows and {Math.min(preview.cols, PREVIEW_COLS)} columns
        {file.sheets && file.sheets.length > 1 ? ` of sheet "${activeSheet ?? file.sheets[0]}"` : ""}.
      </p>
    </div>
  );
}

export function ListingFiles({ value, onChange, error }: {
  value: ListingFile[];
  onChange: (files: ListingFile[]) => void;
  error?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [sheetSel, setSheetSel] = useState<Record<number, string>>({});
  const previewCache = useRef<Map<string, Preview>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const shownError = error ?? localError;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const remaining = MAX_LISTING_FILES - value.length;
    if (remaining <= 0) {
      setLocalError(`Maximum ${MAX_LISTING_FILES} files per listing.`);
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const accepted: ListingFile[] = [];
      let skipped = 0;
      for (const file of incoming) {
        if (accepted.length >= remaining) { skipped++; continue; }
        if (file.size > MAX_FILE_BYTES) { skipped++; continue; }
        const kind = kindOf(file.name);
        if (!kind) { skipped++; continue; }
        try {
          const dataUrl = await fileToDataUrl(file);
          const entry: ListingFile = { name: file.name, size: file.size, dataUrl, kind };
          if (kind === "csv" || kind === "excel" || kind === "tsv") {
            const meta = workbookMeta(dataUrl);
            if (meta) {
              entry.sheets = meta.sheets;
              entry.rows = meta.rows;
              entry.cols = meta.cols;
            }
          }
          accepted.push(entry);
        } catch {
          skipped++;
        }
      }
      if (accepted.length > 0) {
        onChange([...value, ...accepted]);
        setOpenIdx(value.length + accepted.length - 1);
      }
      if (skipped > 0) {
        setLocalError(
          `${skipped} file(s) skipped — unsupported type, or larger than ${formatBytes(MAX_FILE_BYTES)}.`,
        );
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onChange, value]);

  const removeAt = (index: number) => {
    setLocalError(null);
    previewCache.current.clear();
    setSheetSel((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < index) next[idx] = v;
        else if (idx > index) next[idx - 1] = v;
      }
      return next;
    });
    if (openIdx === index) setOpenIdx(null);
    else if (openIdx !== null && openIdx > index) setOpenIdx(openIdx - 1);
    onChange(value.filter((_, i) => i !== index));
  };

  const previewFor = (index: number, file: ListingFile): Preview => {
    const tabular = file.kind === "csv" || file.kind === "excel" || file.kind === "tsv";
    const sheet = tabular ? sheetSel[index] ?? file.sheets?.[0] : "";
    const key = `${index}:${file.kind}:${sheet}`;
    const hit = previewCache.current.get(key);
    if (hit !== undefined) return hit;
    let result: Preview;
    if (!tabular) {
      try {
        result = new TextDecoder().decode(bytesFromDataUrl(file.dataUrl)).slice(0, 400);
      } catch {
        result = "";
      }
    } else {
      result = parseSheet(file.dataUrl, sheet || undefined) ?? "";
    }
    previewCache.current.set(key, result);
    return result;
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">
        Sample data files (CSV, Excel, TSV, JSON, TXT — up to {MAX_LISTING_FILES})
      </span>

      <div
        role="button"
        tabIndex={0}
        aria-label="Add sample data files"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) void addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-xs transition-colors focus:border-accent focus:outline-none ${
          dragOver ? "border-accent bg-accent/10" : "border-edge bg-panel-2 hover:border-accent/60"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span className="text-sm font-semibold text-ink">
          {busy ? "Reading files…" : "Drop CSV or Excel files here, or click to browse"}
        </span>
        <span className="text-muted">
          {value.length}/{MAX_LISTING_FILES} selected · each file up to {formatBytes(MAX_FILE_BYTES)}
        </span>
        <span className="text-[11px] text-muted">
          Preview shows the first rows of your data. Files stay in this browser — never uploaded.
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
        }}
      />

      {shownError ? (
        <p role="alert" className="text-xs text-critical">{shownError}</p>
      ) : null}

      {value.length > 0 ? (
        <ul className="grid gap-1.5">
          {value.map((f, i) => (
            <li key={`${i}-${f.name}`} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 rounded-md border border-edge/60 bg-panel-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    {shortType(f.name)}
                  </span>
                  <span className="truncate text-sm text-ink">{f.name}</span>
                  <span className="shrink-0 text-[11px] text-muted">{formatBytes(f.size)}</span>
                  {f.rows !== undefined && f.cols !== undefined ? (
                    <span className="shrink-0 text-[11px] text-muted">
                      · {f.rows} rows × {f.cols} cols
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                    aria-expanded={openIdx === i}
                    aria-label={`${openIdx === i ? "Hide" : "Show"} preview of ${f.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-panel text-xs text-muted transition-colors hover:border-accent/60 hover:text-accent"
                  >
                    {openIdx === i ? "▾" : "▸"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Remove file ${f.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-panel text-xs text-muted transition-colors hover:border-critical/60 hover:text-critical"
                  >
                    ×
                  </button>
                </div>
              </div>
              {openIdx === i ? (
                <div className="rounded-md border border-edge/60 bg-panel px-3 py-2">
                  <PreviewPanel
                    file={f}
                    preview={previewFor(i, f)}
                    activeSheet={sheetSel[i] ?? f.sheets?.[0]}
                    onSelectSheet={(s) => setSheetSel((prev) => ({ ...prev, [i]: s }))}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {value.length === 0 ? null : (
        <div>
          <Button
            variant="ghost"
            onClick={() => {
              setLocalError(null);
              setOpenIdx(null);
              setSheetSel({});
              previewCache.current.clear();
              onChange([]);
            }}
            className="text-xs"
            aria-label="Remove all files"
          >
            Remove all files
          </Button>
        </div>
      )}
    </div>
  );
}
