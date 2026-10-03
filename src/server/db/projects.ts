import type { Project, ProjectSummary, Role } from '../../shared/types';
import { shortId } from '../lib/crypto';
import { type ProjectRow, toProject, toProjectSummary } from './rows';

export async function listForUser(db: D1Database, userId: string): Promise<ProjectSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*, m.role,
         (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
         (SELECT COUNT(*) FROM tickets t
            WHERE t.project_id = p.id AND t.archived_at IS NULL AND t.status != 'done') AS open_count
       FROM projects p
       JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
       ORDER BY p.created_at DESC`,
    )
    .bind(userId)
    .all<ProjectRow & { role: Role; member_count: number; open_count: number }>();
  return results.map(toProjectSummary);
}

export async function getProject(db: D1Database, id: string): Promise<Project | null> {
  const row = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
  return row ? toProject(row) : null;
}

export async function getRole(db: D1Database, projectId: string, userId: string): Promise<Role | null> {
  const row = await db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .bind(projectId, userId)
    .first<{ role: Role }>();
  return row?.role ?? null;
}

export async function createProject(
  db: D1Database,
  input: { key: string; name: string; description: string; ownerId: string },
): Promise<Project> {
  const id = shortId();
  const now = Date.now();
  // Batched so the project never exists without its owner membership.
  await db.batch([
    db
      .prepare('INSERT INTO projects (id, key, name, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, input.key, input.name, input.description, input.ownerId, now),
    db
      .prepare("INSERT INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)")
      .bind(id, input.ownerId, now),
  ]);
  return { id, key: input.key, name: input.name, description: input.description, ownerId: input.ownerId, createdAt: now };
}

export async function updateProject(
  db: D1Database,
  id: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  await db
    .prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .bind(patch.name ?? null, patch.description ?? null, id)
    .run();
}

export async function deleteProject(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run(); // children cascade
}

export async function removeMember(db: D1Database, projectId: string, userId: string): Promise<void> {
  await db.batch([
    db.prepare('UPDATE tickets SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?').bind(projectId, userId),
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').bind(projectId, userId),
  ]);
}

export async function addMember(db: D1Database, projectId: string, userId: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO project_members (project_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
    .bind(projectId, userId, Date.now())
    .run();
}
