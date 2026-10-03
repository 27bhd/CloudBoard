import type { Ctx } from './context';
import { getUser } from './db/users';
import type { Env } from './env';
import { HttpError, errorResponse, json } from './lib/http';
import { readSessionUserId } from './lib/session';
import { match } from './router';

/** CSRF guard on top of SameSite=Lax: a mutating request must come from our own origin. */
function assertSameOrigin(request: Request, url: URL): void {
  if (request.method === 'GET') return;
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== url.origin) throw new HttpError(403, 'Cross-origin request blocked');
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    const found = match(request.method, url.pathname);
    if (!found) throw new HttpError(404, 'Not found');
    if ('allow' in found) {
      return json({ error: 'Method not allowed' }, 405, { allow: found.allow.join(', ') });
    }
    assertSameOrigin(request, url);

    const userId = await readSessionUserId(env, request);
    const ctx: Ctx = {
      request,
      env,
      url,
      params: found.params,
      user: userId ? await getUser(env.DB, userId) : null,
    };
    return await found.handler(ctx);
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    console.error('Unhandled API error', error);
    return json({ error: 'Something went wrong on our side' }, 500);
  }
}
