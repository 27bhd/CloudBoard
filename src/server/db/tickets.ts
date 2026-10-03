import type { Priority, Status, Ticket, TicketEvent, TicketEventType } from '../../shared/types';
import { shortId } from '../lib/crypto';
import { type EventRow, type TicketRow, toEvent, toTicket } from './rows';

const POSITION_STEP = 1024;

const TICKET_SELECT = `
  SELECT t.*,
         (SELECT comment FROM ticket_events WHERE ticket_id = t.id AND type = 'status' AND to_value = t.status AND comment IS NOT NULL AND TRIM(comment) != '' ORDER BY created_at DESC, rowid DESC LIMIT 1) AS latest_comment
  FROM tickets t
`;

export async function getTicket(db: D1Database, id: string): Promise<Ticket | null> {
  const row = await db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).bind(id).first<TicketRow>();
  return row ? toTicket(row) : null;
}

export async function listActive(db: D1Database, projectId: string): Promise<Ticket[]> {
  const { results } = await db
    .prepare(`${TICKET_SELECT} WHERE t.project_id = ? AND t.archived_at IS NULL ORDER BY t.position`)
    .bind(projectId)
    .all<TicketRow>();
  return results.map(toTicket);
}

export async function listArchived(db: D1Database, projectId: string): Promise<Ticket[]> {
  const { results } = await db
    .prepare(`${TICKET_SELECT} WHERE t.project_id = ? AND t.archived_at IS NOT NULL ORDER BY t.archived_at DESC LIMIT 500`)
    .bind(projectId)
    .all<TicketRow>();
  return results.map(toTicket);
}

export interface NewTicket {
  projectId: string;
  creatorId: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
}

export async function createTicket(db: D1Database, input: NewTicket): Promise<Ticket> {
  // UPDATE … RETURNING is atomic, so concurrent creators always get distinct numbers.
  const seq = await db
    .prepare('UPDATE projects SET ticket_seq = ticket_seq + 1 WHERE id = ? RETURNING ticket_seq')
    .bind(input.projectId)
    .first<{ ticket_seq: number }>();
  if (!seq) throw new Error('Project vanished while creating ticket');

  const last = await db
    .prepare('SELECT MAX(position) AS max FROM tickets WHERE project_id = ? AND status = ? AND archived_at IS NULL')
    .bind(input.projectId, input.status)
    .first<{ max: number | null }>();

  const now = Date.now();
  const id = shortId();
  const position = (last?.max ?? 0) + POSITION_STEP;
  await db.batch([
    db
      .prepare(
        `INSERT INTO tickets (id, project_id, number, title, description, status, priority, assignee_id, creator_id, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.projectId, seq.ticket_seq, input.title, input.description, input.status, input.priority, input.assigneeId, input.creatorId, position, now, now),
    eventStatement(db, { ticketId: id, actorId: input.creatorId, type: 'created', from: null, to: input.status }),
  ]);

  return {
    id,
    projectId: input.projectId,
    number: seq.ticket_seq,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    assigneeId: input.assigneeId,
    creatorId: input.creatorId,
    position,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    latestComment: null,
  };
}

/** Columns a PATCH may touch - the whitelist keeps the dynamic SET clause injection-proof. */
export interface TicketChanges {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  assignee_id?: string | null;
  position?: number;
  archived_at?: number | null;
}

export interface EventInput {
  ticketId: string;
  actorId: string;
  type: TicketEventType;
  from: string | null;
  to: string | null;
  comment?: string | null;
}

export function eventStatement(db: D1Database, event: EventInput): D1PreparedStatement {
  return db
    .prepare('INSERT INTO ticket_events (id, ticket_id, actor_id, type, from_value, to_value, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(shortId(), event.ticketId, event.actorId, event.type, event.from, event.to, event.comment ?? null, Date.now());
}

export async function applyChanges(db: D1Database, ticketId: string, changes: TicketChanges, events: EventInput[]): Promise<void> {
  const columns = Object.keys(changes) as (keyof TicketChanges)[];
  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const values = columns.map((column) => changes[column] ?? null);
  await db.batch([
    db.prepare(`UPDATE tickets SET ${assignments ? `${assignments}, ` : ''}updated_at = ? WHERE id = ?`).bind(...values, Date.now(), ticketId),
    ...events.map((event) => eventStatement(db, event)),
  ]);
}

export async function archiveDone(db: D1Database, projectId: string, actorId: string): Promise<number> {
  const { results } = await db
    .prepare("SELECT id FROM tickets WHERE project_id = ? AND status = 'done' AND archived_at IS NULL")
    .bind(projectId)
    .all<{ id: string }>();
  if (results.length === 0) return 0;
  const now = Date.now();
  await db.batch(
    results.flatMap(({ id }) => [
      db.prepare('UPDATE tickets SET archived_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id),
      eventStatement(db, { ticketId: id, actorId, type: 'archived', from: null, to: null }),
    ]),
  );
  return results.length;
}

export async function listEvents(db: D1Database, ticketId: string): Promise<TicketEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.type, e.from_value, e.to_value, e.comment, e.created_at, e.actor_id,
              u.login AS actor_login, u.name AS actor_name, u.avatar_url AS actor_avatar
       FROM ticket_events e LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.ticket_id = ? ORDER BY e.created_at, e.rowid`,
    )
    .bind(ticketId)
    .all<EventRow>();
  return results.map(toEvent);
}
