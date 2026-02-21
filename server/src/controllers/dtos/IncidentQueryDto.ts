/*
this schema validates and coerces query params for GET /api/incidents.
the active param is a string 'true'/'false' since all query params arrive as strings.
*/

import { z } from 'zod';

export const IncidentQuerySchema = z.object({
  // 'true' returns only open incidents (default), 'false' returns all
  active: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // optionally filter to incidents for a single device
  deviceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type IncidentQueryDto = z.infer<typeof IncidentQuerySchema>;
