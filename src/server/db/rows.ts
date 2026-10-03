import type { Member, Project, ProjectSummary, Role, Ticket, TicketEvent, TicketEventType, User } from '../../shared/types';
import type { Priority, Status } from '../../shared/types';

/** Raw D1 row shapes (snake_case) and their mappers to API types. Kept in one place on purpose. */

export interface UserRow {
  id: string;
  github_id: number;
  login: string;
  name: string;
  avatar_url: string;
  created_at: number;
}

export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string;
  owner_id: string;
  ticket_seq: number;
  created_at: number;
}

export interface TicketRow {
  id: string;
  project_id: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee_id: string | null;
  creator_id: string;
  position: number;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface EventRow {
  id: string;
  type: TicketEventType;
  from_value: string | null;
  to_value: string | null;
  created_at: number;
  actor_id: string | null;
  actor_login: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
}

export const toUser = (row: UserRow): User => ({
  id: row.id,
  login: row.login,
  name: row.name,
  avatarUrl: row.avatar_url,
});

export const toMember = (row: UserRow & { role: Role; joined_at: number }): Member => ({
  ...toUser(row),
  role: row.role,
  joinedAt: row.joined_at,
});

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  ownerId: row.owner_id,
  createdAt: row.created_at,
});

export const toProjectSummary = (
  row: ProjectRow & { role: Role; member_count: number; open_count: number },
): ProjectSummary => ({
  ...toProject(row),
  role: row.role,
  memberCount: row.member_count,
  openCount: row.open_count,
});

export const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  projectId: row.project_id,
  number: row.number,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  assigneeId: row.assignee_id,
  creatorId: row.creator_id,
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at,
});

export const toEvent = (row: EventRow): TicketEvent => ({
  id: row.id,
  type: row.type,
  from: row.from_value,
  to: row.to_value,
  createdAt: row.created_at,
  actor:
    row.actor_id && row.actor_login !== null
      ? { id: row.actor_id, login: row.actor_login, name: row.actor_name ?? row.actor_login, avatarUrl: row.actor_avatar ?? '' }
      : null,
});
