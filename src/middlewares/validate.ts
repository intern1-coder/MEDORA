import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

interface RequestValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const parsedQuery = (await schemas.query.parseAsync(req.query)) as Record<string, unknown>;
        // In Express 5, req.query is a getter. Modify existing object keys without reassigning req.query.
        for (const key of Object.keys(req.query)) {
          delete (req.query as Record<string, unknown>)[key];
        }
        Object.assign(req.query, parsedQuery);
      }
      if (schemas.params) {
        const parsedParams = (await schemas.params.parseAsync(req.params)) as Record<string, unknown>;
        for (const key of Object.keys(req.params)) {
          delete (req.params as Record<string, unknown>)[key];
        }
        Object.assign(req.params, parsedParams);
      }
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const formattedErrors = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message
        }));
        next(new ValidationError('Request validation failed', formattedErrors));
      } else {
        next(err);
      }
    }
  };
}
