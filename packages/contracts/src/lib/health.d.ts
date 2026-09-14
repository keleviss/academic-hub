import { z } from 'zod';
export declare const HealthStatusSchema: z.ZodEnum<{
    ok: "ok";
    degraded: "degraded";
}>;
export declare const HealthResponseSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ok: "ok";
        degraded: "degraded";
    }>;
    service: z.ZodString;
    timestamp: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DatabaseReadinessCheckSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    status: z.ZodLiteral<"ok">;
}, z.core.$strip>, z.ZodObject<{
    reason: z.ZodLiteral<"database_unavailable">;
    status: z.ZodLiteral<"degraded">;
}, z.core.$strip>], "status">;
export declare const StorageReadinessCheckSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    status: z.ZodLiteral<"ok">;
}, z.core.$strip>, z.ZodObject<{
    reason: z.ZodEnum<{
        bucket_missing: "bucket_missing";
        bucket_unavailable: "bucket_unavailable";
        storage_unavailable: "storage_unavailable";
    }>;
    status: z.ZodLiteral<"degraded">;
}, z.core.$strip>], "status">;
export declare const ReadinessResponseSchema: z.ZodObject<{
    checks: z.ZodObject<{
        database: z.ZodDiscriminatedUnion<[z.ZodObject<{
            status: z.ZodLiteral<"ok">;
        }, z.core.$strip>, z.ZodObject<{
            reason: z.ZodLiteral<"database_unavailable">;
            status: z.ZodLiteral<"degraded">;
        }, z.core.$strip>], "status">;
        storage: z.ZodDiscriminatedUnion<[z.ZodObject<{
            status: z.ZodLiteral<"ok">;
        }, z.core.$strip>, z.ZodObject<{
            reason: z.ZodEnum<{
                bucket_missing: "bucket_missing";
                bucket_unavailable: "bucket_unavailable";
                storage_unavailable: "storage_unavailable";
            }>;
            status: z.ZodLiteral<"degraded">;
        }, z.core.$strip>], "status">;
    }, z.core.$strip>;
    service: z.ZodString;
    status: z.ZodEnum<{
        ok: "ok";
        degraded: "degraded";
    }>;
    timestamp: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DatabaseReadinessCheck = z.infer<typeof DatabaseReadinessCheckSchema>;
export type StorageReadinessCheck = z.infer<typeof StorageReadinessCheckSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
//# sourceMappingURL=health.d.ts.map