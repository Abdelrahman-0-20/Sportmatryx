"use client";

import { useRef, useState } from "react";
import { excelFileToCsv, isExcelFileName } from "@/lib/client/xlsx-to-csv";

interface ImportSummary {
  jobId: string;
  fileName: string;
  status: string;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: { row: number; reason: string; detail: string }[];
}

const SAMPLE_CSV = `externalId,timestamp,type,value,unit
EC-10,2025-10-10T06:30:00Z,RESP_RATE,15.5,brpm
EC-10,2025-10-10T06:30:00Z,SPO2,98.2,%
EC-10,2025-10-10T06:30:00Z,HRV_MS,96,ms
EC-01,2025-10-10T07:00:00Z,RESP_RATE,16.1,brpm
EC-99,2025-10-10T07:00:00Z,SPO2,97,%
EC-10,2025-10-10T06:30:00Z,RESP_RATE,15.5,bpm`;

export function ImportPanel() {
  const [summaries, setSummaries] = useState<ImportSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setSummaries([]);
    const failures: string[] = [];
    for (const raw of files) {
      try {
        // Excel workbooks are converted to CSV in the browser; the server
        // route and importCsv pipeline are unchanged.
        const file = isExcelFileName(raw.name) ? await excelFileToCsv(raw) : raw;
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/import", { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          failures.push(`${file.name}: ${body.error ?? "Import failed."}`);
          continue;
        }
        const summary = (await res.json()) as ImportSummary;
        setSummaries((prev) => [...prev, summary]);
      } catch {
        failures.push(`${raw.name}: could not be read as CSV or Excel.`);
      }
    }
    setBusy(false);
    if (failures.length > 0) setError(failures.join(" · "));
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smx_observations_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-h-[36px] cursor-pointer rounded-md bg-accent px-3 py-2 text-sm font-bold text-canvas hover:bg-cyan-300">
          {busy ? "Importing…" : "Choose CSV / Excel files"}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              inputRef.current?.value && (inputRef.current.value = "");
              if (files.length > 0) void uploadFiles(files);
            }}
          />
        </label>
        <button
          type="button"
          onClick={downloadSample}
          className="min-h-[36px] rounded-md border border-edge px-3 text-sm font-semibold hover:bg-panel-2"
        >
          Download template
        </button>
        <span className="text-xs text-muted">CSV or Excel (.xlsx/.xls) · multiple files · per file max 2 MB · 5000 rows · validated against the frozen metric catalog.</span>
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-compromised">{error}</p> : null}

      {summaries.map((summary) => (
        <div key={summary.jobId} className="mt-4 rounded-md border border-edge bg-panel-2 p-3">
          <p className="text-sm">
            <span className={`font-bold ${summary.status === "COMPLETED" ? "text-ready" : summary.status === "FAILED" ? "text-critical" : "text-monitor"}`}>
              {summary.status.replace(/_/g, " ")}
            </span>{" "}
            — {summary.fileName}: {summary.processedRows}/{summary.totalRows} rows imported, {summary.errorRows} rejected.
          </p>
          {summary.errors.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">
                Row-level errors ({summary.errorRows}) — review or download
              </summary>
              <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-xs">
                {summary.errors.map((e, i) => (
                  <li key={i} className="text-muted">
                    <span className="text-compromised">row {e.row}</span> · {e.reason} · {e.detail}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(summary.errors, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `import_errors_${summary.jobId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="mt-2 rounded border border-edge px-2 py-1 text-xs font-semibold hover:bg-panel"
              >
                Download error report
              </button>
            </details>
          ) : null}
        </div>
      ))}
    </div>
  );
}
