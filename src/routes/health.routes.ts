import { Router } from 'express';
import { healthCheckController } from '../controllers/health.controller';
import { validateRequest } from '../middlewares/validate';
import { healthCheckQuerySchema } from '../validators/health.validator';

const router = Router();

router.get('/', validateRequest({ query: healthCheckQuerySchema }), healthCheckController);

export default router;
