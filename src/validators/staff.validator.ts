// src/validators/staff.validator.ts
import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';

export const listStaffQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
});

export const createStaffUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, { message: 'Password must be at least 10 characters' })
    .regex(/[A-Z]/, { message: 'Must contain uppercase character' })
    .regex(/[a-z]/, { message: 'Must contain lowercase character' })
    .regex(/\d/, { message: 'Must contain a digit' })
    .regex(/[^A-Za-z0-9]/, { message: 'Must contain special character' }),
  role: z.enum([Role.RECEPTIONIST, Role.DOCTOR, Role.HOSPITAL_ADMIN]),
});

export const updateStaffStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});
