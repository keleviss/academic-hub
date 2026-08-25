import { z } from 'zod';

import { UserRoleSchema } from './enums.js';

export const CurrentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string().min(1),
  role: UserRoleSchema,
  isActive: z.boolean(),
});

export const CurrentSessionSchema = z.object({
  authenticated: z.boolean(),
  user: CurrentUserSchema.nullable(),
  csrfToken: z.string().min(1).optional(),
});

export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CurrentSession = z.infer<typeof CurrentSessionSchema>;
