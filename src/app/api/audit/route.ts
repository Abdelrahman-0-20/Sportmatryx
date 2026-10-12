import { NextResponse } from "next/server";
import { requireCapability, errorToResponse } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/audit — paginated audit log (audit.read capability). */
export async function GET(request: Request) {
  try {
    await requireCapability("audit.read");
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const take = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? "25") || 25));
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * take,
        take,
        include: { user: { select: { name: true, role: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return NextResponse.json({
      page,
      pageSize: take,
      total,
      rows: rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        actor: r.user ? `${r.user.name ?? "unknown"} (${r.user.role})` : "system",
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        newValue: r.newValue,
        hash: r.hash ? `${r.hash.slice(0, 8)}…` : null,
      })),
    });
  } catch (e) {
    const mapped = errorToResponse(e);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
