export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(code: string, message = "not found") {
  return new AppError(code, message, 404);
}

export function unauthorized(code = "unauthorized", message = "unauthorized") {
  return new AppError(code, message, 401);
}

export function conflict(code: string, message: string) {
  return new AppError(code, message, 409);
}

export function unavailable(code: string, message: string) {
  return new AppError(code, message, 503);
}
