import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import appointmentRoutes from './appointment.routes';
import departmentRoutes from './department.routes';
import doctorRoutes from './doctor.routes';
import staffRoutes from './staff.routes';
import patientRoutes from './patient.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/departments', departmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/staff', staffRoutes);
router.use('/patients', patientRoutes);

export default router;
