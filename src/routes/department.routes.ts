// src/routes/department.routes.ts
import { Router } from 'express';
import {
  listDepartmentsController,
  getDepartmentController,
  createDepartmentController,
  updateDepartmentController,
  deleteDepartmentController,
} from '../controllers/department.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsQuerySchema,
} from '../validators/department.validator';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated read-access to active departments
router.get(
  '/',
  validateRequest({ query: listDepartmentsQuerySchema }),
  listDepartmentsController
);

router.get('/:id', getDepartmentController);

// Administrative operations
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.HOSPITAL_ADMIN),
  validateRequest({ body: createDepartmentSchema }),
  createDepartmentController
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles(Role.HOSPITAL_ADMIN),
  validateRequest({ body: updateDepartmentSchema }),
  updateDepartmentController
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(Role.HOSPITAL_ADMIN),
  deleteDepartmentController
);

export default router;
