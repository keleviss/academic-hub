import { config } from 'dotenv';
import { z } from 'zod';

config();

const LOCAL_SESSION_SECRET = 'local-development-session-secret-change-me';
const LOCAL_CSRF_SECRET = 'local-development-csrf-secret-change-me';
const PLACEHOLDER_SECRET_VALUES = new Set([
  'replace-with-local-session-secret',
  'replace-with-local-csrf-secret',
  LOCAL_SESSION_SECRET,
  LOCAL_CSRF_SECRET,
]);

const BooleanStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return value;
}, z.boolean());

const CorsOriginSchema = z.union([z.literal('*'), z.url()]);

const EnvSchema = z
  .object({
    API_ORIGIN: z.url().default('http://localhost:3000'),
    API_SERVICE_NAME: z.string().min(1).default('api'),
    API_VERSION: z.string().min(1).optional(),
    CORS_ORIGIN: CorsOriginSchema.default('http://localhost:4200'),
    CSRF_COOKIE_NAME: z.string().min(1).default('uniwa_csrf'),
    CSRF_HEADER_NAME: z.string().min(1).default('x-csrf-token'),
    CSRF_SECRET: z.string().min(1).default(LOCAL_CSRF_SECRET),
    DATABASE_URL: z
      .url()
      .default(
        'postgresql://uniwa:uniwa_dev_password@localhost:5432/uniwa_thesis',
      ),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    S3_ACCESS_KEY_ID: z.string().min(1).default('minioadmin'),
    S3_BUCKET: z.string().min(1).default('course-materials'),
    S3_ENDPOINT: z.url().default('http://localhost:9000'),
    S3_FORCE_PATH_STYLE: BooleanStringSchema.default(true),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_SECRET_ACCESS_KEY: z.string().min(1).default('minioadmin123'),
    SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),
    SESSION_COOKIE_NAME: z.string().min(1).default('uniwa_session'),
    SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    SESSION_COOKIE_SECURE: BooleanStringSchema.default(false),
    SESSION_SECRET: z.string().min(1).default(LOCAL_SESSION_SECRET),
    WEB_ORIGIN: z.url().default('http://localhost:4200'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    validateProductionSecret('SESSION_SECRET', env.SESSION_SECRET, context);
    validateProductionSecret('CSRF_SECRET', env.CSRF_SECRET, context);

    if (!env.SESSION_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        message: 'SESSION_COOKIE_SECURE must be true in production',
        path: ['SESSION_COOKIE_SECURE'],
      });
    }

    if (env.CORS_ORIGIN === '*') {
      context.addIssue({
        code: 'custom',
        message: 'CORS_ORIGIN must be an explicit trusted origin in production',
        path: ['CORS_ORIGIN'],
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv();

function validateProductionSecret(
  name: 'SESSION_SECRET' | 'CSRF_SECRET',
  value: string,
  context: z.RefinementCtx,
): void {
  if (value.length < 32 || PLACEHOLDER_SECRET_VALUES.has(value)) {
    context.addIssue({
      code: 'custom',
      message: `${name} must be at least 32 characters and not use a placeholder value in production`,
      path: [name],
    });
  }
}
