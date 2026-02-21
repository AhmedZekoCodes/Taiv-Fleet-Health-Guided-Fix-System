/*
this schema validates and coerces query params for GET /api/devices.
query params arrive as strings, so numeric fields use z.coerce.number().
*/

import { z } from 'zod';
import { DeviceStatus } from '../../domain/enums';

export const DeviceQuerySchema = z.object({
  // optional status filter — must be a valid DeviceStatus enum value
  status: z.nativeEnum(DeviceStatus).optional(),
  // optional venue filter
  venueId: z.string().min(1).optional(),
  // max items to return per page (1–100, default 20)
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // how many items to skip (default 0)
  offset: z.coerce.number().int().min(0).default(0),
});

export type DeviceQueryDto = z.infer<typeof DeviceQuerySchema>;
