import { z } from 'zod';

export const healthCheckQuerySchema = z.object({
  checkDb: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true')
});

export type HealthCheckQuery = z.infer<typeof healthCheckQuerySchema>;
