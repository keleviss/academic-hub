import { z } from 'zod';
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodEmail>;
    password: z.ZodString;
}, z.core.$strip>;
export declare const CsrfResponseSchema: z.ZodObject<{
    csrfToken: z.ZodString;
}, z.core.$strip>;
export declare const CurrentUserSchema: z.ZodObject<{
    id: z.ZodUUID;
    email: z.ZodEmail;
    fullName: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        professor: "professor";
        student: "student";
    }>;
    isActive: z.ZodBoolean;
}, z.core.$strip>;
export declare const CurrentSessionSchema: z.ZodObject<{
    authenticated: z.ZodBoolean;
    user: z.ZodNullable<z.ZodObject<{
        id: z.ZodUUID;
        email: z.ZodEmail;
        fullName: z.ZodString;
        role: z.ZodEnum<{
            admin: "admin";
            professor: "professor";
            student: "student";
        }>;
        isActive: z.ZodBoolean;
    }, z.core.$strip>>;
    csrfToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CurrentSession = z.infer<typeof CurrentSessionSchema>;
//# sourceMappingURL=auth.d.ts.map