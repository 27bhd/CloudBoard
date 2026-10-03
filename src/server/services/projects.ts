import type { CreateProjectBody, Project, UpdateProjectBody, User } from '../../shared/types';
import * as projects from '../db/projects';
import type { Env } from '../env';
import { HttpError, forbidden } from '../lib/http';
import { requireMember, requireOwner } from './access';

/** "Cloud Board" → CB, "Atlas" → ATL, anything unusable → PRJ. */
export function deriveKey(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const raw = words.length >= 2 ? words.slice(0, 4).map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3);
  const key = raw.toUpperCase();
  return key.length >= 2 ? key : 'PRJ';
}

export async function createProject(env: Env, owner: User, body: CreateProjectBody): Promise<Project> {
  return projects.createProject(env.DB, {
    key: deriveKey(body.name),
    name: body.name,
    description: body.description ?? '',
    ownerId: owner.id,
  });
}

export async function updateProject(env: Env, actor: User, projectId: string, patch: UpdateProjectBody): Promise<void> {
  await requireOwner(env, projectId, actor.id);
  await projects.updateProject(env.DB, projectId, patch);
}

export async function deleteProject(env: Env, actor: User, projectId: string): Promise<void> {
  await requireOwner(env, projectId, actor.id);
  await projects.deleteProject(env.DB, projectId);
}

/** Owners can remove anyone else; members can only remove themselves (leave). */
export async function removeMember(env: Env, actor: User, projectId: string, userId: string): Promise<void> {
  const role = await requireMember(env, projectId, actor.id);
  const target = await projects.getRole(env.DB, projectId, userId);
  if (!target) return;
  if (target === 'owner') throw new HttpError(409, 'The owner cannot leave — delete the project instead');
  if (role !== 'owner' && userId !== actor.id) throw forbidden('Only the owner can remove other members');
  await projects.removeMember(env.DB, projectId, userId);
}
