// src/routes/patient.routes.ts
import { Router } from 'express';
import {
  listPatientsController,
  getPatientProfileController,
  registerPatientController,
  updatePatientProfileController,
} from '../controllers/patient.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate';
import {
  listPatientsQuerySchema,
  registerPatientSchema,
  updatePatientSchema,
} from '../validators/patient.validator';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Search & list patients (Staff only: RECEPTIONIST, DOCTOR, HOSPITAL_ADMIN)
router.get(
  '/',
  authorizeRoles(Role.RECEPTIONIST, Role.DOCTOR, Role.HOSPITAL_ADMIN),
  validateRequest({ query: listPatientsQuerySchema }),
  listPatientsController
);

// Register patient (Self-registration by PATIENT or frontdesk by RECEPTIONIST / ADMIN)
router.post(
  '/',
  authorizeRoles(Role.PATIENT, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ body: registerPatientSchema }),
  registerPatientController
);

// Profile view
router.get(
  '/:id',
  authorizeRoles(Role.PATIENT, Role.RECEPTIONIST, Role.DOCTOR, Role.HOSPITAL_ADMIN),
  getPatientProfileController
);

// Profile update
router.put(
  '/:id',
  authorizeRoles(Role.PATIENT, Role.RECEPTIONIST, Role.HOSPITAL_ADMIN),
  validateRequest({ body: updatePatientSchema }),
  updatePatientProfileController
);

export default router;
