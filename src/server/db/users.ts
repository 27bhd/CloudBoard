import type { Member, User } from '../../shared/types';
import { shortId } from '../lib/crypto';
import { type UserRow, toMember, toUser } from './rows';

export interface GithubProfile {
  githubId: number;
  login: string;
  name: string;
  avatarUrl: string;
}

/** Creates the user on first sign-in; refreshes login/name/avatar on every later one. */
export async function upsertUser(db: D1Database, profile: GithubProfile): Promise<User> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, github_id, login, name, avatar_url, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(github_id) DO UPDATE SET login = ?3, name = ?4, avatar_url = ?5
       RETURNING *`,
    )
    .bind(shortId(), profile.githubId, profile.login, profile.name, profile.avatarUrl, Date.now())
    .first<UserRow>();
  if (!row) throw new Error('User upsert returned no row');
  return toUser(row);
}

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function listMembers(db: D1Database, projectId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT u.*, m.role, m.joined_at FROM project_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.project_id = ?
       ORDER BY m.joined_at`,
    )
    .bind(projectId)
    .all<UserRow & { role: Member['role']; joined_at: number }>();
  return results.map(toMember);
}
