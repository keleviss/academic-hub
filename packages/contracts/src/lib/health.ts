import { z } from 'zod';

export const HealthStatusSchema = z.enum(['ok', 'degraded']);

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  service: z.string().min(1),
  timestamp: z.string().min(1),
  version: z.string().min(1).optional(),
});

export const DatabaseReadinessCheckSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
  }),
  z.object({
    reason: z.literal('database_unavailable'),
    status: z.literal('degraded'),
  }),
]);

export const StorageReadinessCheckSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
  }),
  z.object({
    reason: z.enum([
      'bucket_missing',
      'bucket_unavailable',
      'storage_unavailable',
    ]),
    status: z.literal('degraded'),
  }),
]);

export const ReadinessResponseSchema = z.object({
  checks: z.object({
    database: DatabaseReadinessCheckSchema,
    storage: StorageReadinessCheckSchema,
  }),
  service: z.string().min(1),
  status: HealthStatusSchema,
  timestamp: z.string().min(1),
  version: z.string().min(1).optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DatabaseReadinessCheck = z.infer<
  typeof DatabaseReadinessCheckSchema
>;
export type StorageReadinessCheck = z.infer<
  typeof StorageReadinessCheckSchema
>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
