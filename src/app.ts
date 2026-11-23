import express, { Application } from 'express';
import { env } from './config/env';
import { securityHeaders, requestLogger } from './middlewares/security';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFound';
import apiRoutes from './routes';

export function createApp(): Application {
  const app = express();

  // Basic security and parsing middleware
  app.use(securityHeaders);
  app.use(requestLogger);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root health redirect / quick ping
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', message: 'Medora API Service Operational' });
  });

  // Mount API V1 routes
  app.use(env.API_PREFIX, apiRoutes);

  // 404 Handler for undefined routes
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
