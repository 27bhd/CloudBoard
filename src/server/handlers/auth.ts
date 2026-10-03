import type { MeResponse } from '../../shared/types';
import type { Ctx, Handler } from '../context';
import { upsertUser } from '../db/users';
import { randomToken, sha256Hex } from '../lib/crypto';
import { HttpError, badRequest, json, redirect } from '../lib/http';
import {
  clearOAuthCookie,
  clearSessionCookie,
  createOAuthCookie,
  createSessionCookie,
  isSecure,
  readOAuthCookie,
  safeNext,
} from '../lib/session';

const isLocalhost = (url: URL): boolean => url.hostname === 'localhost' || url.hostname === '127.0.0.1';

/** Dev sign-in needs both the flag AND a localhost origin, so a leaked flag can't open production. */
const devAuthEnabled = (ctx: Ctx): boolean => ctx.env.DEV_AUTH === '1' && isLocalhost(ctx.url);

export const me: Handler = async (ctx) => {
  const body: MeResponse = { user: ctx.user, devAuth: devAuthEnabled(ctx) };
  return json(body);
};

export const startGithub: Handler = async (ctx) => {
  if (!ctx.env.GITHUB_CLIENT_ID) throw new HttpError(503, 'GitHub OAuth is not configured. See the README.');
  const secure = isSecure(ctx.url);
  const state = randomToken(24);
  const next = safeNext(ctx.url.searchParams.get('next'));
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', ctx.env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${ctx.url.origin}/api/auth/callback`);
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);
  return redirect(authorize.toString(), { 'set-cookie': await createOAuthCookie(ctx.env, state, next, secure) });
};

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export const githubCallback: Handler = async (ctx) => {
  const secure = isSecure(ctx.url);
  const code = ctx.url.searchParams.get('code');
  const state = ctx.url.searchParams.get('state');
  const saved = await readOAuthCookie(ctx.env, ctx.request);
  if (!code || !state || !saved || saved.state !== state) throw badRequest('Sign-in expired. Please try again.');

  // Direct token exchange with plain fetch without external auth libraries.
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: ctx.env.GITHUB_CLIENT_ID,
      client_secret: ctx.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${ctx.url.origin}/api/auth/callback`,
    }),
  });
  const token = (await tokenResponse.json()) as GithubTokenResponse;
  if (!token.access_token) throw badRequest('GitHub rejected the sign-in. Please try again.');

  const profileResponse = await fetch('https://api.github.com/user', {
    // GitHub's API rejects requests without a User-Agent.
    headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': 'CloudBoard', accept: 'application/vnd.github+json' },
  });
  if (!profileResponse.ok) throw new HttpError(502, 'Could not read your GitHub profile');
  const profile = (await profileResponse.json()) as GithubUserResponse;
  // The access token is discarded here: we only need identity, never repo access.

  const user = await upsertUser(ctx.env.DB, {
    githubId: profile.id,
    login: profile.login,
    name: profile.name?.trim() || profile.login,
    avatarUrl: profile.avatar_url,
  });

  const headers = new Headers();
  headers.append('set-cookie', await createSessionCookie(ctx.env, user.id, secure));
  headers.append('set-cookie', clearOAuthCookie(secure));
  return redirect(safeNext(saved.next), headers);
};

/** Offline sign-in for contributors: creates a local user with a negative github_id so it never collides. */
export const devLogin: Handler = async (ctx) => {
  if (!devAuthEnabled(ctx)) throw new HttpError(404, 'Not found');
  const login = (ctx.url.searchParams.get('login') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
  if (!login) throw badRequest('Pick a username');
  const hash = await sha256Hex(`dev:${login}`);
  const user = await upsertUser(ctx.env.DB, {
    githubId: -parseInt(hash.slice(0, 10), 16) - 1,
    login,
    name: login,
    avatarUrl: '',
  });
  return redirect(safeNext(ctx.url.searchParams.get('next')), {
    'set-cookie': await createSessionCookie(ctx.env, user.id, isSecure(ctx.url)),
  });
};

export const logout: Handler = async (ctx) => json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(isSecure(ctx.url)) });
