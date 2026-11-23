import { Response } from 'express';
import { ApiResponseEnvelope } from '../types/api';
import { HTTP_STATUS, HttpStatusCode } from '../constants/http';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: HttpStatusCode = HTTP_STATUS.OK,
  meta?: Record<string, unknown>
): Response {
  const envelope: ApiResponseEnvelope<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(envelope);
}
