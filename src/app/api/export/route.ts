import { handleExport } from "@/lib/services/export";

export const dynamic = "force-dynamic";

/** GET /api/export?scope=roster|athlete&id=&deidentified=1&days=28 → CSV download. */
export function GET(request: Request) {
  return handleExport(request);
}
