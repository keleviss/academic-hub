import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFoundHandler(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  next(
    new HttpError(
      404,
      `Route ${request.method} ${request.originalUrl} not found`,
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

  if (error instanceof ZodError) {
    response.status(500).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Response validation failed',
      },
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        code: error.statusCode === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
    },
  });
};
