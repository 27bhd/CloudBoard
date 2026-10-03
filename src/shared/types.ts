/**
 * API contract shared by the edge handlers and the browser client.
 * Everything that crosses the network is described here; nothing else is imported across the boundary.
 */

export const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const INVITE_DURATIONS_HOURS = [24, 48, 168] as const;
export type InviteDurationHours = (typeof INVITE_DURATIONS_HOURS)[number];

export const LIMITS = {
  projectName: 60,
  projectDescription: 280,
  ticketTitle: 200,
  ticketDescription: 10_000,
} as const;

export type Role = 'owner' | 'member';

export interface User {
  id: string;
  login: string;
  name: string;
  /** Empty for local dev users; the client falls back to initials. */
  avatarUrl: string;
}

export interface Member extends User {
  role: Role;
  joinedAt: number;
}

export interface Project {
  id: string;
  /** Short uppercase prefix used in ticket ids, e.g. `CB` in `CB-12`. */
  key: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
}

export interface ProjectSummary extends Project {
  role: Role;
  memberCount: number;
  openCount: number;
}

export interface Ticket {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string;
  /** Fractional index within a column; lower sorts first. */
  position: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  latestComment: string | null;
}

export type TicketEventType =
  | 'created'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'title'
  | 'description'
  | 'archived'
  | 'restored';

export interface TicketEvent {
  id: string;
  type: TicketEventType;
  actor: User | null;
  from: string | null;
  to: string | null;
  comment: string | null;
  createdAt: number;
}

export interface InviteSummary {
  id: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreatedInvite extends InviteSummary {
  /** Only ever returned once, at creation. */
  token: string;
}

// ---- Request / response bodies ----

export interface MeResponse {
  user: User | null;
  /** True only on localhost when DEV_AUTH=1, enables the offline sign-in form. */
  devAuth: boolean;
}

export interface CreateProjectBody {
  name: string;
  description?: string;
}

export interface UpdateProjectBody {
  name?: string;
  description?: string;
}

export interface BoardResponse {
  project: Project;
  role: Role;
  members: Member[];
  tickets: Ticket[];
}

export interface CreateTicketBody {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
}

export interface UpdateTicketBody {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  position?: number;
  statusComment?: string;
}

export interface TicketDetailResponse {
  ticket: Ticket;
  events: TicketEvent[];
}

export interface CreateInviteBody {
  hours: InviteDurationHours;
}

export type InviteState = 'valid' | 'expired' | 'member';

export interface InvitePreview {
  projectName: string;
  invitedBy: string;
  expiresAt: number;
  state: InviteState;
}

export interface AcceptInviteResponse {
  projectId: string;
}

export interface ApiErrorBody {
  error: string;
}
