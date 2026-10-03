import type { InvitePreview, InviteSummary, CreatedInvite, InviteDurationHours, User } from '../../shared/types';
import * as invites from '../db/invites';
import * as projects from '../db/projects';
import type { Env } from '../env';
import { randomToken, sha256Hex } from '../lib/crypto';
import { HttpError, notFound } from '../lib/http';
import { requireOwner } from './access';

export async function createInvite(env: Env, actor: User, projectId: string, hours: InviteDurationHours): Promise<CreatedInvite> {
  await requireOwner(env, projectId, actor.id);
  const token = randomToken(32); // 256 bits — the token itself is the credential
  const summary = await invites.createInvite(env.DB, {
    projectId,
    tokenHash: await sha256Hex(token),
    createdBy: actor.id,
    expiresAt: Date.now() + hours * 3600 * 1000,
  });
  return { ...summary, token };
}

export async function listInvites(env: Env, actor: User, projectId: string): Promise<InviteSummary[]> {
  await requireOwner(env, projectId, actor.id);
  return invites.listActiveInvites(env.DB, projectId);
}

export async function revokeInvite(env: Env, actor: User, projectId: string, inviteId: string): Promise<void> {
  await requireOwner(env, projectId, actor.id);
  await invites.deleteInvite(env.DB, projectId, inviteId);
}

async function lookup(env: Env, token: string) {
  const invite = await invites.findInviteByHash(env.DB, await sha256Hex(token));
  if (!invite) throw notFound('This invite link is not valid');
  return invite;
}

export async function previewInvite(env: Env, viewer: User | null, token: string): Promise<InvitePreview> {
  const invite = await lookup(env, token);
  const isMember = viewer ? (await projects.getRole(env.DB, invite.projectId, viewer.id)) !== null : false;
  return {
    projectName: invite.projectName,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
    state: isMember ? 'member' : invite.expiresAt <= Date.now() ? 'expired' : 'valid',
  };
}

export async function acceptInvite(env: Env, actor: User, token: string): Promise<string> {
  const invite = await lookup(env, token);
  if (invite.expiresAt <= Date.now()) throw new HttpError(410, 'This invite has expired');
  await projects.addMember(env.DB, invite.projectId, actor.id); // idempotent
  return invite.projectId;
}
