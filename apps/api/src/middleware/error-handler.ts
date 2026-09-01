import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express';
import type { ApiErrorResponse } from '@web-app/contracts';
import { ZodError } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { RequestValidationError } from '../lib/request-validation.js';

export { HttpError } from '../lib/http-error.js';

export function notFoundHandler(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  next(
    new HttpError(
      404,
      `Route ${request.method} ${request.originalUrl} not found`,
      undefined,
      'NOT_FOUND',
    ),
  );
}

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  void _request;
  void next;

  if (error instanceof RequestValidationError) {
    sendErrorResponse(response, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    sendErrorResponse(response, 500, {
      error: {
        code: 'RESPONSE_VALIDATION_ERROR',
        message: 'Response validation failed',
      },
    });
    return;
  }

  if (error instanceof HttpError) {
    sendErrorResponse(response, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  sendErrorResponse(response, 500, {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
    },
  });
};

function sendErrorResponse(
  response: Response,
  statusCode: number,
  payload: ApiErrorResponse,
): void {
  response.status(statusCode).json(payload);
}
