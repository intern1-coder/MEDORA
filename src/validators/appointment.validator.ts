// src/validators/appointment.validator.ts
import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';

export const listAppointmentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  doctorId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string' }).optional(),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string' }).optional(),
});

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid().optional(), // Injected or checked for PATIENT role
  doctorId: z.string().uuid(),
  departmentId: z.string().uuid(),
  slotStart: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string for slotStart' }),
  slotEnd: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string for slotEnd' }),
  status: z.nativeEnum(AppointmentStatus).optional(),
  cancellationReason: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z.object({
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  slotStart: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string for slotStart' }).optional(),
  slotEnd: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid ISO date string for slotEnd' }).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  cancellationReason: z.string().max(500).optional(),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z.string().max(500).optional(),
});
