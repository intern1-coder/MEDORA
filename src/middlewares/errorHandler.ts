import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ApiErrorEnvelope } from '../types/api';
import { HTTP_STATUS, ERROR_CODES } from '../constants/http';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response {
  const timestamp = new Date().toISOString();

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[AppError] ${err.statusCode} - ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        stack: err.stack,
        details: err.details
      });
    } else {
      logger.warn(`[AppError] ${err.statusCode} - ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        details: err.details
      });
    }

    const payload: ApiErrorEnvelope = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      },
      timestamp
    };

    return res.status(err.statusCode).json(payload);
  }

  // Handle unhandled errors
  logger.error(`[UnhandledError] ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    stack: err.stack
  });

  const payload: ApiErrorEnvelope = {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      ...(env.NODE_ENV !== 'production' ? { details: err.stack } : {})
    },
    timestamp
  };

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(payload);
}
