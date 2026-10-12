import { NextResponse } from "next/server";
import { requireCapability, errorToResponse } from "@/lib/auth/rbac";
import { importCsv } from "@/lib/services/import";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/import — multipart CSV upload with real validation.
 * Limits: 2 MB file, 5000 rows (documented per spec §14).
 */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

export async function POST(request: Request) {
  try {
    const user = await requireCapability("import.run");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A CSV file field named 'file' is required.", code: "VALIDATION" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File exceeds the ${MAX_BYTES / 1024 / 1024} MB limit.`, code: "VALIDATION" }, { status: 413 });
    }
    const text = await file.text();
    const lineCount = text.split("\n").filter((l) => l.trim()).length;
    if (lineCount > MAX_ROWS + 1) {
      return NextResponse.json({ error: `File exceeds the ${MAX_ROWS} data-row limit.`, code: "VALIDATION" }, { status: 413 });
    }
    const summary = await importCsv(text, file.name, "CSV Import", user.id);
    await audit({
      userId: user.id,
      action: "IMPORT_RUN",
      entityType: "ImportJob",
      entityId: summary.jobId,
      newValue: { fileName: summary.fileName, status: summary.status, processedRows: summary.processedRows, errorRows: summary.errorRows },
    });
    return NextResponse.json(summary);
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
