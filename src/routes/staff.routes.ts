// src/routes/staff.routes.ts
import { Router } from 'express';
import {
  listStaffController,
  createStaffUserController,
  updateStaffStatusController,
} from '../controllers/staff.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate';
import {
  listStaffQuerySchema,
  createStaffUserSchema,
  updateStaffStatusSchema,
} from '../validators/staff.validator';
import { Role } from '@prisma/client';

const router = Router();

// Staff management is strictly Hospital Admin only per ROLE_PERMISSION_MATRIX
router.use(authenticate, authorizeRoles(Role.HOSPITAL_ADMIN));

router.get(
  '/',
  validateRequest({ query: listStaffQuerySchema }),
  listStaffController
);

router.post(
  '/',
  validateRequest({ body: createStaffUserSchema }),
  createStaffUserController
);

router.patch(
  '/:id/status',
  validateRequest({ body: updateStaffStatusSchema }),
  updateStaffStatusController
);

export default router;
