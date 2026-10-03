import type { User } from '../shared/types';
import type { Env } from './env';
import { unauthorized } from './lib/http';

/** Per-request context handed to every route handler. */
export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  /** Resolved from the signed session cookie; null when signed out. */
  user: User | null;
}

export type Handler = (ctx: Ctx) => Promise<Response>;

export function requireUser(ctx: Ctx): User {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}
