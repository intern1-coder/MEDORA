// src/routes/appointment.routes.ts
import { Router } from 'express';
import {
  createAppointmentController,
  getAppointmentController,
  updateAppointmentController,
  cancelAppointmentController,
  listAppointmentsController,
} from '../controllers/appointment.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  cancelAppointmentSchema,
  listAppointmentsQuerySchema,
} from '../validators/appointment.validator';
import { Role } from '@prisma/client';

const router = Router();

// All appointment operations require authentication
router.use(authenticate);

// GET / — List appointments with pagination and filters
router.get(
  '/',
  authorizeRoles(Role.PATIENT, Role.DOCTOR, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ query: listAppointmentsQuerySchema }),
  listAppointmentsController
);

// POST / — Book appointment slot (Patient books own, Staff books any)
router.post(
  '/',
  authorizeRoles(Role.PATIENT, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ body: createAppointmentSchema }),
  createAppointmentController
);

// GET /:id — Get appointment details (Patient views own, Doctor/Staff views)
router.get(
  '/:id',
  authorizeRoles(Role.PATIENT, Role.DOCTOR, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  getAppointmentController
);

// PATCH /:id — Reschedule or update status (Doctor, Receptionist, Admin, Patient)
router.patch(
  '/:id',
  authorizeRoles(Role.PATIENT, Role.DOCTOR, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ body: updateAppointmentSchema }),
  updateAppointmentController
);

// DELETE /:id — Cancel appointment (Soft cancellation with BR-APPT-006 check)
router.delete(
  '/:id',
  authorizeRoles(Role.PATIENT, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ body: cancelAppointmentSchema }),
  cancelAppointmentController
);

export default router;
