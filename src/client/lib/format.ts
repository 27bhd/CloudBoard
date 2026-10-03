import { PRIORITY_LABEL, STATUS_LABEL, type Status, type Ticket, type TicketEvent } from '../../shared/types';

export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeLeft(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((ms - now) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export const ticketKey = (projectKey: string, ticket: Pick<Ticket, 'number'>): string => `${projectKey}-${ticket.number}`;

const label = (value: string | null, map: Record<string, string>): string => (value ? (map[value] ?? value) : 'nobody');

/** Human sentence for an audit-log row, e.g. "moved this from Todo to In progress". */
export function describeEvent(event: TicketEvent): string {
  switch (event.type) {
    case 'created':
      return `created this in ${label(event.to, STATUS_LABEL)}`;
    case 'status':
      return `moved this from ${label(event.from, STATUS_LABEL)} to ${label(event.to, STATUS_LABEL)}`;
    case 'priority':
      return `set priority to ${label(event.to, PRIORITY_LABEL).toLowerCase()}`;
    case 'assignee':
      return event.to ? `assigned this to @${event.to}` : `unassigned @${event.from ?? 'someone'}`;
    case 'title':
      return `renamed this from “${event.from ?? ''}”`;
    case 'description':
      return 'edited the description';
    case 'archived':
      return 'archived this';
    case 'restored':
      return 'restored this from the archive';
  }
}

export function sortColumn(tickets: Ticket[], status: Status): Ticket[] {
  return tickets.filter((ticket) => ticket.status === status).sort((a, b) => a.position - b.position);
}

/** Sizes a textarea to its content. */
export function autosize(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
