import type { InviteSummary } from '../../shared/types';
import { shortId } from '../lib/crypto';

interface InviteLookupRow {
  id: string;
  project_id: string;
  project_name: string;
  invited_by: string;
  expires_at: number;
}

export interface InviteLookup {
  id: string;
  projectId: string;
  projectName: string;
  invitedBy: string;
  expiresAt: number;
}

export async function createInvite(
  db: D1Database,
  input: { projectId: string; tokenHash: string; createdBy: string; expiresAt: number },
): Promise<InviteSummary> {
  const id = shortId();
  const now = Date.now();
  await db.batch([
    // Opportunistic cleanup keeps the table tiny without needing a cron trigger.
    db.prepare('DELETE FROM invites WHERE expires_at < ?').bind(now - 7 * 24 * 3600 * 1000),
    db
      .prepare('INSERT INTO invites (id, project_id, token_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, input.projectId, input.tokenHash, input.createdBy, now, input.expiresAt),
  ]);
  return { id, createdAt: now, expiresAt: input.expiresAt };
}

export async function findInviteByHash(db: D1Database, tokenHash: string): Promise<InviteLookup | null> {
  const row = await db
    .prepare(
      `SELECT i.id, i.project_id, p.name AS project_name, u.name AS invited_by, i.expires_at
       FROM invites i
       JOIN projects p ON p.id = i.project_id
       JOIN users u ON u.id = i.created_by
       WHERE i.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<InviteLookupRow>();
  return row
    ? { id: row.id, projectId: row.project_id, projectName: row.project_name, invitedBy: row.invited_by, expiresAt: row.expires_at }
    : null;
}

export async function listActiveInvites(db: D1Database, projectId: string): Promise<InviteSummary[]> {
  const { results } = await db
    .prepare('SELECT id, created_at, expires_at FROM invites WHERE project_id = ? AND expires_at > ? ORDER BY created_at DESC')
    .bind(projectId, Date.now())
    .all<{ id: string; created_at: number; expires_at: number }>();
  return results.map((row) => ({ id: row.id, createdAt: row.created_at, expiresAt: row.expires_at }));
}

export async function deleteInvite(db: D1Database, projectId: string, inviteId: string): Promise<void> {
  await db.prepare('DELETE FROM invites WHERE id = ? AND project_id = ?').bind(inviteId, projectId).run();
}
