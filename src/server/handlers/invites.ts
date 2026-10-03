import type { AcceptInviteResponse } from '../../shared/types';
import { requireUser, type Handler } from '../context';
import { json } from '../lib/http';
import * as invites from '../services/invites';

const token = (ctx: Parameters<Handler>[0]): string => ctx.params['token'] ?? '';

/** Public on purpose: the join page shows the project name before asking the visitor to sign in. */
export const preview: Handler = async (ctx) => json(await invites.previewInvite(ctx.env, ctx.user, token(ctx)));

export const accept: Handler = async (ctx) => {
  const projectId = await invites.acceptInvite(ctx.env, requireUser(ctx), token(ctx));
  const body: AcceptInviteResponse = { projectId };
  return json(body);
};
