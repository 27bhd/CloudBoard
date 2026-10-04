import type { ApiErrorBody } from '../../shared/types';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = () => new HttpError(401, 'Sign in to continue');
export const forbidden = (message = 'You do not have access to this') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  merged.set('content-type', 'application/json; charset=utf-8');
  merged.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: merged });
}

export function errorResponse(error: HttpError): Response {
  const body: ApiErrorBody = { error: error.message };
  return json(body, error.status);
}

export function redirect(location: string, headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  merged.set('location', location);
  return new Response(null, { status: 302, headers: merged });
}

// ---- Body parsing & validation (no schema library on purpose) ----

export type JsonObject = Record<string, unknown>;

export async function readJsonValue(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest('Invalid JSON payload');
  }
}

export async function readJson(request: Request): Promise<JsonObject> {
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as JsonObject;
  } catch {
    // fall through
  }
  throw badRequest('Expected a JSON object body');
}

export function requiredString(body: JsonObject, key: string, max: number): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw badRequest(`${key} is required`);
  if (value.trim().length > max) throw badRequest(`${key} must be at most ${max} characters`);
  return value.trim();
}

export function optionalString(body: JsonObject, key: string, max: number): string | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw badRequest(`${key} must be a string`);
  if (value.length > max) throw badRequest(`${key} must be at most ${max} characters`);
  return value;
}

export function optionalEnum<const T extends readonly string[]>(
  body: JsonObject,
  key: string,
  allowed: T,
): T[number] | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) throw badRequest(`${key} is invalid`);
  return value;
}

export function optionalNumber(body: JsonObject, key: string): number | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw badRequest(`${key} must be a number`);
  return value;
}

/** `undefined` = not provided, `null` = explicitly cleared. */
export function optionalNullableString(body: JsonObject, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw badRequest(`${key} must be a string or null`);
  return value;
}
