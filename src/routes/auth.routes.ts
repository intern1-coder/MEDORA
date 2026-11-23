import { Router } from 'express';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  meController
} from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validateRequest({ body: registerSchema }), registerController);
router.post('/login', validateRequest({ body: loginSchema }), loginController);
router.post('/refresh', validateRequest({ body: refreshTokenSchema }), refreshController);
router.post('/logout', authenticate, validateRequest({ body: logoutSchema }), logoutController);
router.get('/me', authenticate, meController);

export default router;
