import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { HttpError } from './http-error.js';

type RequestValidationSource = 'body' | 'params' | 'query';

export interface RequestValidationIssue {
  source: RequestValidationSource;
  path: string[];
  code: string;
  message: string;
}

export interface RequestValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export class RequestValidationError extends HttpError {
  constructor(public readonly issues: RequestValidationIssue[]) {
    super(
      400,
      'Request validation failed',
      { issues },
      'REQUEST_VALIDATION_ERROR',
    );
    this.name = 'RequestValidationError';
  }
}

export function validateRequest(
  schemas: RequestValidationSchemas,
): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    void _response;

    const parsedParts: Partial<Record<RequestValidationSource, unknown>> = {};
    const issues: RequestValidationIssue[] = [];

    validateRequestPart(
      'params',
      schemas.params,
      request.params,
      parsedParts,
      issues,
    );
    validateRequestPart(
      'query',
      schemas.query,
      request.query,
      parsedParts,
      issues,
    );
    validateRequestPart(
      'body',
      schemas.body,
      request.body,
      parsedParts,
      issues,
    );

    if (issues.length > 0) {
      next(new RequestValidationError(issues));
      return;
    }

    if ('params' in parsedParts) {
      assignRequestPart(request, 'params', parsedParts.params);
    }

    if ('query' in parsedParts) {
      assignRequestPart(request, 'query', parsedParts.query);
    }

    if ('body' in parsedParts) {
      assignRequestPart(request, 'body', parsedParts.body);
    }

    next();
  };
}

function validateRequestPart(
  source: RequestValidationSource,
  schema: ZodType | undefined,
  value: unknown,
  parsedParts: Partial<Record<RequestValidationSource, unknown>>,
  issues: RequestValidationIssue[],
): void {
  if (!schema) {
    return;
  }

  const result = schema.safeParse(value);

  if (result.success) {
    parsedParts[source] = result.data;
    return;
  }

  issues.push(
    ...result.error.issues.map((issue) => ({
      source,
      path: issue.path.map(String),
      code: issue.code,
      message: issue.message,
    })),
  );
}

function assignRequestPart(
  request: Request,
  source: RequestValidationSource,
  value: unknown,
): void {
  Object.defineProperty(request, source, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}
