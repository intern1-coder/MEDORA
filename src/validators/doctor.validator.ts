// src/validators/doctor.validator.ts
import { z } from 'zod';

export const listDoctorsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  departmentId: z.string().uuid().optional(),
  specialization: z.string().optional(),
  search: z.string().optional(),
});

export const createDoctorProfileSchema = z.object({
  userId: z.string().uuid(),
  licenseNumber: z.string().min(3).max(50),
  specialization: z.string().min(2).max(100),
  qualifications: z.string().min(2).max(255),
  consultationFee: z.number().positive(),
  defaultSlotMinutes: z.number().int().min(5).max(120).optional().default(15),
  roomNumber: z.string().max(50).optional(),
  bio: z.string().max(2000).optional(),
  departmentIds: z.array(z.string().uuid()).min(1),
  primaryDepartmentId: z.string().uuid().optional(),
});

export const updateDoctorProfileSchema = z.object({
  specialization: z.string().min(2).max(100).optional(),
  qualifications: z.string().min(2).max(255).optional(),
  consultationFee: z.number().positive().optional(),
  defaultSlotMinutes: z.number().int().min(5).max(120).optional(),
  roomNumber: z.string().max(50).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
});

export const setDoctorScheduleSchema = z.object({
  schedules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday, 6 = Saturday
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Format must be HH:mm' }),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Format must be HH:mm' }),
      isActive: z.boolean().optional().default(true),
    })
  ),
});

export const createDoctorLeaveSchema = z.object({
  startDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid start date' }),
  endDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid end date' }),
  reason: z.string().max(500).optional(),
});

export const queryAvailableSlotsSchema = z.object({
  date: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date query parameter' }),
});
