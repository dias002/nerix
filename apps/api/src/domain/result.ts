export type Result<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: DomainError;
    };

export type DomainErrorCode =
  | "not_found"
  | "validation_failed"
  | "unauthorized"
  | "insufficient_credits"
  | "subscription_required"
  | "daily_text_limit_exceeded"
  | "provider_unavailable"
  | "internal_error";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly statusCode: number;

  constructor(code: DomainErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: DomainError): Result<T> {
  return { ok: false, error };
}
