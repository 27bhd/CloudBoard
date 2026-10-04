import type {
  AcceptInviteResponse,
  BoardResponse,
  BulkImportResponse,
  BulkImportTicketItem,
  CreateInviteBody,
  CreateProjectBody,
  CreateTicketBody,
  CreatedInvite,
  InvitePreview,
  InviteSummary,
  MeResponse,
  Project,
  ProjectSummary,
  Ticket,
  TicketDetailResponse,
  UpdateTicketBody,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (handler: () => void): void => {
  onUnauthorized = handler;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? 'Request failed';
    if (response.status === 401) onUnauthorized();
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

/** Every endpoint the client talks to, typed against src/shared/types. */
export const api = {
  me: () => request<MeResponse>('GET', '/api/me'),
  logout: () => request<{ ok: true }>('POST', '/api/auth/logout'),

  listProjects: () => request<ProjectSummary[]>('GET', '/api/projects'),
  createProject: (body: CreateProjectBody) => request<Project>('POST', '/api/projects', body),
  board: (id: string) => request<BoardResponse>('GET', `/api/projects/${id}`),
  deleteProject: (id: string) => request<{ ok: true }>('DELETE', `/api/projects/${id}`),
  leaveProject: (id: string, userId: string) => request<{ ok: true }>('DELETE', `/api/projects/${id}/members/${userId}`),
  archive: (id: string) => request<Ticket[]>('GET', `/api/projects/${id}/archive`),
  archiveDone: (id: string) => request<{ archived: number }>('POST', `/api/projects/${id}/archive-done`),

  createTicket: (projectId: string, body: CreateTicketBody) => request<Ticket>('POST', `/api/projects/${projectId}/tickets`, body),
  importTickets: (projectId: string, tickets: BulkImportTicketItem[]) =>
    request<BulkImportResponse>('POST', `/api/projects/${projectId}/tickets/import`, tickets),
  ticket: (id: string) => request<TicketDetailResponse>('GET', `/api/tickets/${id}`),
  updateTicket: (id: string, body: UpdateTicketBody) => request<Ticket>('PATCH', `/api/tickets/${id}`, body),
  archiveTicket: (id: string) => request<Ticket>('POST', `/api/tickets/${id}/archive`),
  restoreTicket: (id: string) => request<Ticket>('POST', `/api/tickets/${id}/restore`),

  invites: (projectId: string) => request<InviteSummary[]>('GET', `/api/projects/${projectId}/invites`),
  createInvite: (projectId: string, body: CreateInviteBody) => request<CreatedInvite>('POST', `/api/projects/${projectId}/invites`, body),
  revokeInvite: (projectId: string, inviteId: string) => request<{ ok: true }>('DELETE', `/api/projects/${projectId}/invites/${inviteId}`),
  previewInvite: (token: string) => request<InvitePreview>('GET', `/api/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) => request<AcceptInviteResponse>('POST', `/api/invites/${encodeURIComponent(token)}/accept`),
};
