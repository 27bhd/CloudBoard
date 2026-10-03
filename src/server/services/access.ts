import type { Role } from '../../shared/types';
import type { Env } from '../env';
import * as projects from '../db/projects';
import { forbidden, notFound } from '../lib/http';

/** Non-members get a 404, never a 403, so project ids can't be probed. */
export async function requireMember(env: Env, projectId: string, userId: string): Promise<Role> {
  const role = await projects.getRole(env.DB, projectId, userId);
  if (!role) throw notFound('Project not found');
  return role;
}

export async function requireOwner(env: Env, projectId: string, userId: string): Promise<void> {
  const role = await requireMember(env, projectId, userId);
  if (role !== 'owner') throw forbidden('Only the project owner can do this');
}
