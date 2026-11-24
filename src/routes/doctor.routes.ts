// src/routes/doctor.routes.ts
import { Router } from 'express';
import {
  listDoctorsController,
  getDoctorProfileController,
  createDoctorProfileController,
  updateDoctorProfileController,
  setDoctorScheduleController,
  addDoctorLeaveController,
  getDoctorAvailableSlotsController,
} from '../controllers/doctor.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate';
import {
  listDoctorsQuerySchema,
  createDoctorProfileSchema,
  updateDoctorProfileSchema,
  setDoctorScheduleSchema,
  createDoctorLeaveSchema,
  queryAvailableSlotsSchema,
} from '../validators/doctor.validator';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated discovery
router.get(
  '/',
  validateRequest({ query: listDoctorsQuerySchema }),
  listDoctorsController
);

router.get('/:id', getDoctorProfileController);

router.get(
  '/:id/available-slots',
  validateRequest({ query: queryAvailableSlotsSchema }),
  getDoctorAvailableSlotsController
);

// Admin-only profile creation
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.HOSPITAL_ADMIN),
  validateRequest({ body: createDoctorProfileSchema }),
  createDoctorProfileController
);

// Profile and Schedule updates (Doctor or Admin)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(Role.DOCTOR, Role.HOSPITAL_ADMIN),
  validateRequest({ body: updateDoctorProfileSchema }),
  updateDoctorProfileController
);

router.put(
  '/:id/schedule',
  authenticate,
  authorizeRoles(Role.DOCTOR, Role.HOSPITAL_ADMIN),
  validateRequest({ body: setDoctorScheduleSchema }),
  setDoctorScheduleController
);

router.post(
  '/:id/leaves',
  authenticate,
  authorizeRoles(Role.DOCTOR, Role.HOSPITAL_ADMIN),
  validateRequest({ body: createDoctorLeaveSchema }),
  addDoctorLeaveController
);

export default router;
