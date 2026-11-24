// src/utils/audit.ts
import { prisma } from '../config/database';
import { createHash } from 'crypto';
import { Role } from '@prisma/client';

export interface AuditLogParams {
  actorUserId?: string | null;
  actorRole: Role | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  action: string;
  entityName: string;
  entityId: string;
  payloadSummary?: Record<string, unknown> | null;
}

/**
 * Record a tamper-evident audit log entry with SHA-256 hash chaining.
 * As documented in ARCHITECTURE.md Section 3.9:
 * recordHash = SHA256(fields + previousHash)
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    // 1. Fetch previous record hash for chaining
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { recordHash: true },
    });
    const previousHash = lastLog?.recordHash || 'GENESIS_HASH_MEDORA_2026';

    // 2. Compute cryptographic record hash
    const hashPayload = JSON.stringify({
      actorUserId: params.actorUserId || null,
      actorRole: params.actorRole,
      action: params.action,
      entityName: params.entityName,
      entityId: params.entityId,
      payloadSummary: params.payloadSummary || null,
      previousHash,
    });

    const recordHash = createHash('sha256').update(hashPayload).digest('hex');

    // 3. Persist append-only audit entry
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId || null,
        actorRole: params.actorRole,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId,
        payloadSummary: params.payloadSummary ? (params.payloadSummary as any) : undefined,
        previousHash,
        recordHash,
      },
    });
  } catch (err) {
    // In production, write to stderr or persistent file logger so application flow is not broken
    console.error('[AuditLog] Failed to record audit log entry:', err);
  }
}
