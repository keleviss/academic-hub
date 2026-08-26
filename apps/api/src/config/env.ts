import { config } from 'dotenv';
import { z } from 'zod';

config();

const EnvSchema = z.object({
  API_SERVICE_NAME: z.string().min(1).default('api'),
  API_VERSION: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:4200'),
  DATABASE_URL: z
    .url()
    .default(
      'postgresql://uniwa:uniwa_dev_password@localhost:5432/uniwa_thesis',
    ),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv();
