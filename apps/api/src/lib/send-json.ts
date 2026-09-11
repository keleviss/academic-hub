import type { Response } from 'express';
import type { ZodType } from 'zod';

export function sendJson<T>(
  response: Response,
  statusCode: number,
  schema: ZodType<T>,
  payload: unknown,
): void {
  response.status(statusCode).json(schema.parse(payload));
}
