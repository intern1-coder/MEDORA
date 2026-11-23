// src/validators/queue.validator.ts
import { z } from 'zod';
import { UrgencyLevel } from '@prisma/client';

export const enterQueueSchema = z.object({
  departmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional().nullable(),
  urgencyLevel: z.nativeEnum(UrgencyLevel).optional(),
});

export const serveQueueSchema = z.object({
  departmentId: z.string().uuid(),
});
