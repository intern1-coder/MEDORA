import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
// TODO: MED-006 routes – will be added once implementation is ready
// import appointmentRoutes from './appointment.routes';
// import queueRoutes from './queue.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
// router.use('/appointments', appointmentRoutes);
// router.use('/queues', queueRoutes);

export default router;
