import { LIMITS, PRIORITIES, STATUSES, type TicketDetailResponse, type UpdateTicketBody } from '../../shared/types';
import { requireUser, type Handler } from '../context';
import { listEvents } from '../db/tickets';
import { json, optionalEnum, optionalNullableString, optionalNumber, optionalString, readJson, badRequest } from '../lib/http';
import * as tickets from '../services/tickets';

const ticketId = (ctx: Parameters<Handler>[0]): string => ctx.params['id'] ?? '';

export const detail: Handler = async (ctx) => {
  const ticket = await tickets.getTicketForMember(ctx.env, requireUser(ctx), ticketId(ctx));
  const body: TicketDetailResponse = { ticket, events: await listEvents(ctx.env.DB, ticket.id) };
  return json(body);
};

export const update: Handler = async (ctx) => {
  const body = await readJson(ctx.request);
  const title = optionalString(body, 'title', LIMITS.ticketTitle);
  if (title !== undefined && title.trim().length === 0) throw badRequest('title cannot be empty');
  const patch: UpdateTicketBody = {
    title: title?.trim(),
    description: optionalString(body, 'description', LIMITS.ticketDescription),
    status: optionalEnum(body, 'status', STATUSES),
    priority: optionalEnum(body, 'priority', PRIORITIES),
    assigneeId: optionalNullableString(body, 'assigneeId'),
    position: optionalNumber(body, 'position'),
  };
  return json(await tickets.updateTicket(ctx.env, requireUser(ctx), ticketId(ctx), patch));
};

export const archive: Handler = async (ctx) => json(await tickets.archiveTicket(ctx.env, requireUser(ctx), ticketId(ctx)));

export const restore: Handler = async (ctx) => json(await tickets.restoreTicket(ctx.env, requireUser(ctx), ticketId(ctx)));
