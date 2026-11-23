// src/validators/appointment.validator.ts
import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  slotStart: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date' }),
  slotEnd: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date' }),
  roomId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  slotStart: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date' }).optional(),
  slotEnd: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date' }).optional(),
  roomId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().optional(),
});
