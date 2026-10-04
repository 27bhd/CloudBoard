import type { Handler } from './context';
import * as auth from './handlers/auth';
import * as inviteHandlers from './handlers/invites';
import * as projectHandlers from './handlers/projects';
import * as ticketHandlers from './handlers/tickets';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

function route(method: Method, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${source}$`), keys, handler };
}

/** The whole HTTP surface of the API, readable top to bottom. */
const routes: Route[] = [
  route('GET', '/api/me', auth.me),
  route('GET', '/api/auth/github', auth.startGithub),
  route('GET', '/api/auth/callback', auth.githubCallback),
  route('GET', '/api/auth/dev', auth.devLogin),
  route('POST', '/api/auth/logout', auth.logout),

  route('GET', '/api/projects', projectHandlers.list),
  route('POST', '/api/projects', projectHandlers.create),
  route('GET', '/api/projects/:id', projectHandlers.board),
  route('PATCH', '/api/projects/:id', projectHandlers.update),
  route('DELETE', '/api/projects/:id', projectHandlers.remove),
  route('DELETE', '/api/projects/:id/members/:userId', projectHandlers.removeMember),
  route('GET', '/api/projects/:id/archive', projectHandlers.archive),
  route('POST', '/api/projects/:id/archive-done', projectHandlers.archiveDone),
  route('POST', '/api/projects/:id/tickets', projectHandlers.createTicket),
  route('POST', '/api/projects/:id/tickets/import', projectHandlers.importTickets),
  route('GET', '/api/projects/:id/invites', projectHandlers.listInvites),
  route('POST', '/api/projects/:id/invites', projectHandlers.createInvite),
  route('DELETE', '/api/projects/:id/invites/:inviteId', projectHandlers.revokeInvite),

  route('GET', '/api/tickets/:id', ticketHandlers.detail),
  route('PATCH', '/api/tickets/:id', ticketHandlers.update),
  route('POST', '/api/tickets/:id/archive', ticketHandlers.archive),
  route('POST', '/api/tickets/:id/restore', ticketHandlers.restore),

  route('GET', '/api/invites/:token', inviteHandlers.preview),
  route('POST', '/api/invites/:token/accept', inviteHandlers.accept),
];

export interface Match {
  handler: Handler;
  params: Record<string, string>;
}

/** Returns the matched route, or the allowed methods if the path exists under other verbs. */
export function match(method: string, pathname: string): Match | { allow: Method[] } | null {
  const allow: Method[] = [];
  for (const candidate of routes) {
    const result = candidate.pattern.exec(pathname);
    if (!result) continue;
    if (candidate.method !== method) {
      allow.push(candidate.method);
      continue;
    }
    const params: Record<string, string> = {};
    candidate.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(result[index + 1] ?? '');
    });
    return { handler: candidate.handler, params };
  }
  return allow.length > 0 ? { allow } : null;
}
