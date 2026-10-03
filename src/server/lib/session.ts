import type { Env } from '../env';
import { sign, unsign } from './crypto';

const SESSION_COOKIE = 'cb_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

interface CookieOptions {
  maxAge: number;
  secure: boolean;
}

export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) cookies.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return cookies;
}

export function serializeCookie(name: string, value: string, { maxAge, secure }: CookieOptions): string {
  // Lax (not Strict): the OAuth redirect back from GitHub is a cross-site top-level navigation.
  const parts = [`${name}=${value}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export const isSecure = (url: URL): boolean => url.protocol === 'https:';

/**
 * Sessions are stateless: `userId:expiry` signed with HMAC-SHA256.
 * Trade-off: there is no server-side revocation list; logging out clears the cookie
 * and sessions expire after 30 days.
 */
export async function createSessionCookie(env: Env, userId: string, secure: boolean): Promise<string> {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const signed = await sign(env.SESSION_SECRET, `${userId}:${expires}`);
  return serializeCookie(SESSION_COOKIE, signed, { maxAge: SESSION_TTL_SECONDS, secure });
}

export function clearSessionCookie(secure: boolean): string {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure });
}

export async function readSessionUserId(env: Env, request: Request): Promise<string | null> {
  const raw = parseCookies(request.headers.get('cookie')).get(SESSION_COOKIE);
  if (!raw) return null;
  const value = await unsign(env.SESSION_SECRET, raw);
  if (!value) return null;
  const [userId, expires] = value.split(':');
  if (!userId || !expires || Number(expires) < Date.now()) return null;
  return userId;
}

// ---- Short-lived signed cookie used to carry OAuth state across the GitHub redirect ----

const OAUTH_COOKIE = 'cb_oauth';
const OAUTH_TTL_SECONDS = 600;

export async function createOAuthCookie(env: Env, state: string, next: string, secure: boolean): Promise<string> {
  const signed = await sign(env.SESSION_SECRET, `${state}~${encodeURIComponent(next)}`);
  return serializeCookie(OAUTH_COOKIE, signed, { maxAge: OAUTH_TTL_SECONDS, secure });
}

export async function readOAuthCookie(env: Env, request: Request): Promise<{ state: string; next: string } | null> {
  const raw = parseCookies(request.headers.get('cookie')).get(OAUTH_COOKIE);
  if (!raw) return null;
  const value = await unsign(env.SESSION_SECRET, raw);
  if (!value) return null;
  const [state, next] = value.split('~');
  if (!state || next === undefined) return null;
  return { state, next: decodeURIComponent(next) };
}

export const clearOAuthCookie = (secure: boolean): string => serializeCookie(OAUTH_COOKIE, '', { maxAge: 0, secure });

/** Only same-origin absolute paths - prevents open redirects through `?next=`. */
export function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
  return '/';
}
