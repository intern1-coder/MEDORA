import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  authenticateUser,
  refreshUserSession,
  logoutUser,
  getUserProfile
} from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';
import { RegisterInput, LoginInput, RefreshTokenInput, LogoutInput } from '../validators/auth.validator';

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as RegisterInput;
    const result = await registerUser(input);
    sendSuccess(res, result, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as LoginInput;
    const deviceInfo = req.headers['user-agent'];
    const result = await authenticateUser(input, deviceInfo);
    sendSuccess(res, result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as RefreshTokenInput;
    const deviceInfo = req.headers['user-agent'];
    const result = await refreshUserSession(refreshToken, deviceInfo);
    sendSuccess(res, result, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as LogoutInput;
    const userId = req.user!.userId;
    await logoutUser(userId, refreshToken);
    sendSuccess(res, { message: 'Logged out successfully' }, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
}

export async function meController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const profile = await getUserProfile(userId);
    sendSuccess(res, profile, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
}
