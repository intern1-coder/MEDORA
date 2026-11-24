// src/validators/department.validator.ts
import { z } from 'zod';

export const listDepartmentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  description: z.string().max(1000).optional(),
  roomNumbers: z.array(z.string().min(1).max(20)).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).toUpperCase().optional(),
  description: z.string().max(1000).optional(),
  roomNumbers: z.array(z.string().min(1).max(20)).optional(),
  isActive: z.boolean().optional(),
});
