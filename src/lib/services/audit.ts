import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

/**
 * Tamper-evident audit chain (per the governance reference design).
 * hash_n = SHA-256(prevHash_n ‖ canonicalJSON(record_n without hash)).
 * Genesis prevHash = 64 zeros. Append-only by convention; verification
 * recomputes the whole chain and reports the first broken link.
 */

const GENESIS = "0".repeat(64);

interface AuditInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export function computeHash(prevHash: string, record: Omit<Prisma.AuditLogUncheckedCreateInput, "hash" | "prevHash">): string {
  const payload = canonical({
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId ?? null,
    oldValue: record.oldValue ?? null,
    newValue: record.newValue ?? null,
    userId: record.userId ?? null,
    ipAddress: record.ipAddress ?? null,
    timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : record.timestamp,
  });
  return createHash("sha256").update(`${prevHash}${payload}`).digest("hex");
}

/** Append an audit entry linked into the hash chain. */
export async function audit(input: AuditInput): Promise<void> {
  const last = await prisma.auditLog.findFirst({ orderBy: { timestamp: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS;
  const record: Omit<Prisma.AuditLogUncheckedCreateInput, "hash" | "prevHash"> = {
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    oldValue: (input.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
    newValue: (input.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
    ipAddress: input.ipAddress ?? null,
    timestamp: new Date(),
  };
  const hash = computeHash(prevHash, record);
  await prisma.auditLog.create({ data: { ...record, prevHash, hash } as Prisma.AuditLogUncheckedCreateInput });
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  firstBrokenSeq: number | null;
  detail: string | null;
}

/** Walk the chain in timestamp order and recompute every link. */
export async function verifyAuditChain(): Promise<ChainVerification> {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: "asc" } });
  let expectedPrev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const payload: Omit<Prisma.AuditLogUncheckedCreateInput, "hash" | "prevHash"> = {
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      oldValue: (row.oldValue ?? undefined) as Prisma.InputJsonValue | undefined,
      newValue: (row.newValue ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: row.ipAddress,
      timestamp: row.timestamp,
    };
    const recomputed = computeHash(expectedPrev, payload);
    if (row.prevHash !== expectedPrev || row.hash !== recomputed) {
      return {
        ok: false,
        checked: rows.length,
        firstBrokenSeq: i,
        detail: `Row ${i} (${row.action}): stored hash does not match recomputed chain value — record was altered or inserted out of order.`,
      };
    }
    expectedPrev = row.hash as string;
  }
  return { ok: true, checked: rows.length, firstBrokenSeq: null, detail: null };
}
