import { NextResponse } from "next/server";
import { requireCapability, errorToResponse } from "@/lib/auth/rbac";
import { verifyAuditChain } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/** GET /api/audit/verify — recompute the whole hash chain. */
export async function GET() {
  try {
    await requireCapability("audit.read");
    const result = await verifyAuditChain();
    return NextResponse.json(result);
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
