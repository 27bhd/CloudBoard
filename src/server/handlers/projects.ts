import {
  INVITE_DURATIONS_HOURS,
  LIMITS,
  PRIORITIES,
  STATUSES,
  type BoardResponse,
  type CreateInviteBody,
  type CreateProjectBody,
  type InviteDurationHours,
  type UpdateProjectBody,
} from '../../shared/types';
import { requireUser, type Handler } from '../context';
import * as projectsDb from '../db/projects';
import * as ticketsDb from '../db/tickets';
import * as usersDb from '../db/users';
import {
  badRequest,
  json,
  notFound,
  optionalEnum,
  optionalNullableString,
  optionalString,
  readJson,
  readJsonValue,
  requiredString,
} from '../lib/http';
import { requireMember } from '../services/access';
import * as invites from '../services/invites';
import * as projects from '../services/projects';
import * as tickets from '../services/tickets';

const param = (ctx: Parameters<Handler>[0], name: string): string => ctx.params[name] ?? '';

export const list: Handler = async (ctx) => {
  const user = requireUser(ctx);
  return json(await projectsDb.listForUser(ctx.env.DB, user.id));
};

export const create: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const body = await readJson(ctx.request);
  const input: CreateProjectBody = {
    name: requiredString(body, 'name', LIMITS.projectName),
    description: optionalString(body, 'description', LIMITS.projectDescription)?.trim(),
  };
  return json(await projects.createProject(ctx.env, user, input), 201);
};

export const board: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const id = param(ctx, 'id');
  const role = await requireMember(ctx.env, id, user.id);
  const [project, members, activeTickets] = await Promise.all([
    projectsDb.getProject(ctx.env.DB, id),
    usersDb.listMembers(ctx.env.DB, id),
    ticketsDb.listActive(ctx.env.DB, id),
  ]);
  if (!project) throw notFound('Project not found');
  const body: BoardResponse = { project, role, members, tickets: activeTickets };
  return json(body);
};

export const update: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const body = await readJson(ctx.request);
  const patch: UpdateProjectBody = {
    name: body.name === undefined ? undefined : requiredString(body, 'name', LIMITS.projectName),
    description: optionalString(body, 'description', LIMITS.projectDescription)?.trim(),
  };
  await projects.updateProject(ctx.env, user, param(ctx, 'id'), patch);
  return json({ ok: true });
};

export const remove: Handler = async (ctx) => {
  await projects.deleteProject(ctx.env, requireUser(ctx), param(ctx, 'id'));
  return json({ ok: true });
};

export const removeMember: Handler = async (ctx) => {
  await projects.removeMember(ctx.env, requireUser(ctx), param(ctx, 'id'), param(ctx, 'userId'));
  return json({ ok: true });
};

export const archive: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const id = param(ctx, 'id');
  await requireMember(ctx.env, id, user.id);
  return json(await ticketsDb.listArchived(ctx.env.DB, id));
};

export const archiveDone: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const id = param(ctx, 'id');
  await requireMember(ctx.env, id, user.id);
  return json({ archived: await ticketsDb.archiveDone(ctx.env.DB, id, user.id) });
};

export const createTicket: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const body = await readJson(ctx.request);
  const ticket = await tickets.createTicket(ctx.env, user, param(ctx, 'id'), {
    title: requiredString(body, 'title', LIMITS.ticketTitle),
    description: optionalString(body, 'description', LIMITS.ticketDescription),
    status: optionalEnum(body, 'status', STATUSES),
    priority: optionalEnum(body, 'priority', PRIORITIES),
    assigneeId: optionalNullableString(body, 'assigneeId'),
  });
  return json(ticket, 201);
};

export const importTickets: Handler = async (ctx) => {
  const user = requireUser(ctx);
  const body = await readJsonValue(ctx.request);
  const rawList = Array.isArray(body) ? body : (body as { tickets?: unknown } | null | undefined)?.tickets;
  if (!Array.isArray(rawList)) throw badRequest('Expected a JSON array of tickets');
  const created = await tickets.bulkImportTickets(ctx.env, user, param(ctx, 'id'), rawList);
  return json({ count: created.length, tickets: created }, 201);
};

// ---- Invites (owner-only; token is returned exactly once) ----

export const listInvites: Handler = async (ctx) =>
  json(await invites.listInvites(ctx.env, requireUser(ctx), param(ctx, 'id')));

export const createInvite: Handler = async (ctx) => {
  const body = await readJson(ctx.request);
  const hours = body.hours;
  if (typeof hours !== 'number' || !(INVITE_DURATIONS_HOURS as readonly number[]).includes(hours)) {
    throw badRequest(`hours must be one of ${INVITE_DURATIONS_HOURS.join(', ')}`);
  }
  const input: CreateInviteBody = { hours: hours as InviteDurationHours };
  return json(await invites.createInvite(ctx.env, requireUser(ctx), param(ctx, 'id'), input.hours), 201);
};

export const revokeInvite: Handler = async (ctx) => {
  await invites.revokeInvite(ctx.env, requireUser(ctx), param(ctx, 'id'), param(ctx, 'inviteId'));
  return json({ ok: true });
};
