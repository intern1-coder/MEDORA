// src/validators/patient.validator.ts
import { z } from 'zod';
import { BloodGroup, Gender } from '@prisma/client';

export const listPatientsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  search: z.string().optional(), // Searches MRN, phone, firstName, lastName
  mrn: z.string().optional(),
  phone: z.string().optional(),
});

export const registerPatientSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  dob: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date of birth' }),
  gender: z.nativeEnum(Gender),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional().default(BloodGroup.UNKNOWN),
  allergies: z.array(z.string()).optional().default([]),
  existingConditions: z.array(z.string()).optional().default([]),
  emergencyContactName: z.string().min(1).max(100),
  emergencyContactPhone: z.string().min(7).max(20),
  userId: z.string().uuid().optional(),
});

export const updatePatientSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  dob: z.string().refine((s) => !isNaN(Date.parse(s)), { message: 'Invalid date of birth' }).optional(),
  gender: z.nativeEnum(Gender).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  allergies: z.array(z.string()).optional(),
  existingConditions: z.array(z.string()).optional(),
  emergencyContactName: z.string().min(1).max(100).optional(),
  emergencyContactPhone: z.string().min(7).max(20).optional(),
});
