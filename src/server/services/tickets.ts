import type { CreateTicketBody, Ticket, UpdateTicketBody, User } from '../../shared/types';
import * as projects from '../db/projects';
import * as tickets from '../db/tickets';
import * as users from '../db/users';
import type { Env } from '../env';
import { HttpError, badRequest, notFound } from '../lib/http';
import { requireMember } from './access';

async function loadForMember(env: Env, actor: User, ticketId: string): Promise<Ticket> {
  const ticket = await tickets.getTicket(env.DB, ticketId);
  if (!ticket) throw notFound('Ticket not found');
  await requireMember(env, ticket.projectId, actor.id); // same 404 as a missing ticket for outsiders
  return ticket;
}

export async function getTicketForMember(env: Env, actor: User, ticketId: string): Promise<Ticket> {
  return loadForMember(env, actor, ticketId);
}

async function assertAssignable(env: Env, projectId: string, assigneeId: string | null): Promise<void> {
  if (assigneeId === null) return;
  if (!(await projects.getRole(env.DB, projectId, assigneeId))) throw badRequest('Assignee must be a project member');
}

export async function createTicket(env: Env, actor: User, projectId: string, body: Required<Pick<CreateTicketBody, 'title'>> & CreateTicketBody): Promise<Ticket> {
  await requireMember(env, projectId, actor.id);
  const assigneeId = body.assigneeId ?? null;
  await assertAssignable(env, projectId, assigneeId);
  return tickets.createTicket(env.DB, {
    projectId,
    creatorId: actor.id,
    title: body.title,
    description: body.description ?? '',
    status: body.status ?? 'todo',
    priority: body.priority ?? 'none',
    assigneeId,
  });
}

export async function updateTicket(env: Env, actor: User, ticketId: string, patch: UpdateTicketBody): Promise<Ticket> {
  const ticket = await loadForMember(env, actor, ticketId);
  if (ticket.archivedAt !== null) throw new HttpError(409, 'Restore this ticket before editing it');

  const changes: tickets.TicketChanges = {};
  const events: tickets.EventInput[] = [];
  const log = (type: tickets.EventInput['type'], from: string | null, to: string | null) =>
    events.push({ ticketId, actorId: actor.id, type, from, to });

  if (patch.title !== undefined && patch.title !== ticket.title) {
    changes.title = patch.title;
    log('title', ticket.title, patch.title);
  }
  if (patch.description !== undefined && patch.description !== ticket.description) {
    changes.description = patch.description;
    log('description', null, null); // bodies can be large; the log only records that it changed
  }
  if (patch.status !== undefined && patch.status !== ticket.status) {
    changes.status = patch.status;
    log('status', ticket.status, patch.status);
  }
  if (patch.priority !== undefined && patch.priority !== ticket.priority) {
    changes.priority = patch.priority;
    log('priority', ticket.priority, patch.priority);
  }
  if (patch.assigneeId !== undefined && patch.assigneeId !== ticket.assigneeId) {
    await assertAssignable(env, ticket.projectId, patch.assigneeId);
    changes.assignee_id = patch.assigneeId;
    const [from, to] = await Promise.all([
      ticket.assigneeId ? users.getUser(env.DB, ticket.assigneeId) : null,
      patch.assigneeId ? users.getUser(env.DB, patch.assigneeId) : null,
    ]);
    log('assignee', from?.login ?? null, to?.login ?? null);
  }
  if (patch.position !== undefined) changes.position = patch.position;

  if (Object.keys(changes).length === 0) return ticket;
  await tickets.applyChanges(env.DB, ticketId, changes, events);
  const updated = await tickets.getTicket(env.DB, ticketId);
  if (!updated) throw notFound('Ticket not found');
  return updated;
}

export async function archiveTicket(env: Env, actor: User, ticketId: string): Promise<Ticket> {
  const ticket = await loadForMember(env, actor, ticketId);
  if (ticket.status !== 'done') throw badRequest('Only done tickets can be archived');
  if (ticket.archivedAt === null) {
    await tickets.applyChanges(env.DB, ticketId, { archived_at: Date.now() }, [
      { ticketId, actorId: actor.id, type: 'archived', from: null, to: null },
    ]);
  }
  const updated = await tickets.getTicket(env.DB, ticketId);
  if (!updated) throw notFound('Ticket not found');
  return updated;
}

export async function restoreTicket(env: Env, actor: User, ticketId: string): Promise<Ticket> {
  const ticket = await loadForMember(env, actor, ticketId);
  if (ticket.archivedAt !== null) {
    await tickets.applyChanges(env.DB, ticketId, { archived_at: null }, [
      { ticketId, actorId: actor.id, type: 'restored', from: null, to: null },
    ]);
  }
  const updated = await tickets.getTicket(env.DB, ticketId);
  if (!updated) throw notFound('Ticket not found');
  return updated;
}
