// src/services/queue.service.ts
import { prisma } from '../config/database';
import { QueueToken, QueueStatus, UrgencyLevel, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, BadRequestError } from '../errors/AppError';
import { addSeconds } from 'date-fns';

/** Helper to fetch ordered queue for a department (clinic) */
export async function getQueueByDepartment(departmentId: string): Promise<QueueToken[]> {
  return prisma.queueToken.findMany({
    where: { departmentId },
    orderBy: [
      { urgencyLevel: 'desc' }, // EMERGENCY > URGENT > STANDARD (enum order)
      { createdAt: 'asc' },
    ],
  });
}

/** Enter queue – creates a token after duplicate‑entry protection (15 s) */
export async function enterQueue(params: {
  departmentId: string;
  patientId: string;
  doctorId?: string | null;
  urgencyLevel?: UrgencyLevel;
}): Promise<QueueToken> {
  const { departmentId, patientId, doctorId = null, urgencyLevel = UrgencyLevel.STANDARD } = params;

  // Duplicate‑entry protection: any waiting token for same patient/clinic/doctor created within last 15 s
  const fifteenSecAgo = addSeconds(new Date(), -15);
  const recent = await prisma.queueToken.findFirst({
    where: {
      patientId,
      departmentId,
      doctorId,
      status: QueueStatus.WAITING,
      createdAt: { gte: fifteenSecAgo },
    },
  });
  if (recent) {
    throw new ConflictError('Duplicate queue entry detected within 15 seconds');
  }

  // Simple tokenNumber generation – use ISO timestamp for uniqueness
  const tokenNumber = `T${Date.now()}`;

  const token = await prisma.queueToken.create({
    data: {
      tokenNumber,
      tokenDate: new Date(),
      departmentId,
      patientId,
      doctorId,
      urgencyLevel,
    },
  });
  return token;
}

/** Serve next eligible token for a department */
export async function serveNext(departmentId: string, serveByUserId: string): Promise<QueueToken> {
  // Find the first waiting token according to ordering
  const token = await prisma.queueToken.findFirst({
    where: { departmentId, status: QueueStatus.WAITING },
    orderBy: [
      { urgencyLevel: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!token) {
    throw new NotFoundError('No waiting tokens in the queue');
  }

  // Update status to SERVED and record servedAt & callCount
  const updated = await prisma.queueToken.update({
    where: { id: token.id },
    data: {
      status: QueueStatus.SERVED,
      servedAt: new Date(),
      callCount: { increment: 1 },
      urgencyAssignedById: serveByUserId,
    },
  });
  return updated;
}
