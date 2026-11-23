import { Request, Response, NextFunction } from 'express';
import { getHealthStatus } from '../services/health.service';
import { sendSuccess } from '../utils/response';
import { HTTP_STATUS } from '../constants/http';

export async function healthCheckController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const checkDb = req.query.checkDb === 'true' || String(req.query.checkDb) === 'true';
    const health = await getHealthStatus(checkDb);

    const statusCode = health.status === 'ok' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
    sendSuccess(res, health, statusCode);
  } catch (error) {
    next(error);
  }
}
