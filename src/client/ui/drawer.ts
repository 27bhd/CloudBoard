import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  type Member,
  type Priority,
  type Project,
  type Status,
  type Ticket,
  type TicketEvent,
  type UpdateTicketBody,
} from '../../shared/types';
import { api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { autosize, copyText, describeEvent, ticketKey, timeAgo } from '../lib/format';
import { toast } from '../lib/toast';
import { avatar } from './avatar';
import { icon, priorityIcon, statusIcon } from './icons';
import { promptStatusComment } from './statusModal';

export interface DrawerDeps {
  project: Project;
  members: Member[];
  ticket: Ticket;
  /** Applies the patch optimistically on the board; resolves with the server copy, or null if it failed and was rolled back. */
  update: (ticketId: string, patch: UpdateTicketBody) => Promise<Ticket | null>;
  archive: (ticket: Ticket) => Promise<Ticket | null>;
  restore: (ticket: Ticket) => Promise<Ticket | null>;
  close: () => void;
}

const optionList = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => h('option', { value }, labels[value]));

function row(label: string, ...control: Node[]): HTMLElement {
  return h('div', { class: 'flex min-h-9 items-center gap-3' }, h('span', { class: 'eyebrow w-20 shrink-0' }, label), h('div', { class: 'flex min-w-0 items-center gap-1' }, ...control));
}

export function ticketDrawer(deps: DrawerDeps): { el: HTMLElement; destroy: () => void } {
  let ticket = deps.ticket;
  const locked = () => ticket.archivedAt !== null;

  // ── Title ──
  const title = h('textarea', {
    class: 'w-full resize-none bg-transparent font-display text-[1.75rem] leading-tight outline-none placeholder:text-mute',
    rows: 1,
    maxLength: 200,
    placeholder: 'Untitled',
    attrs: { 'aria-label': 'Title' },
  });
  title.addEventListener('input', () => autosize(title));
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      title.blur();
    }
  });
  title.addEventListener('blur', () => {
    const next = title.value.trim();
    if (!next) title.value = ticket.title;
    else if (next !== ticket.title) void commit({ title: next });
  });

  // ── Properties ──
  const statusSelect = h('select', { class: 'select', attrs: { 'aria-label': 'Status' } }, ...optionList(STATUSES, STATUS_LABEL));
  const prioritySelect = h('select', { class: 'select', attrs: { 'aria-label': 'Priority' } }, ...optionList(PRIORITIES, PRIORITY_LABEL));
  const assigneeSelect = h(
    'select',
    { class: 'select', attrs: { 'aria-label': 'Assignee' } },
    h('option', { value: '' }, 'Unassigned'),
    ...deps.members.map((member) => h('option', { value: member.id }, member.name)),
  );
  const statusSlot = h('span', { class: 'grid size-5 place-items-center' });
  const prioritySlot = h('span', { class: 'grid size-5 place-items-center' });
  const assigneeSlot = h('span', { class: 'grid size-6 place-items-center' });

  statusSelect.addEventListener('change', async () => {
    const nextStatus = statusSelect.value as Status;
    if (nextStatus === ticket.status) return;

    const comment = await promptStatusComment({
      ticketTitle: ticket.title,
      fromStatus: ticket.status,
      toStatus: nextStatus,
    });

    if (comment === null) {
      statusSelect.value = ticket.status; // revert UI selection
      return;
    }

    void commit({ status: nextStatus, statusComment: comment });
  });

  prioritySelect.addEventListener('change', () => void commit({ priority: prioritySelect.value as Priority }));
  assigneeSelect.addEventListener('change', () => void commit({ assigneeId: assigneeSelect.value || null }));

  // ── Description (Explicit Save & Cancel) ──
  const description = h('textarea', {
    class: 'input !h-auto min-h-28 resize-none !bg-transparent !py-3 leading-relaxed',
    placeholder: 'Add context, links, acceptance criteria…',
    maxLength: 10_000,
    attrs: { 'aria-label': 'Description' },
  });

  let isSavingDescription = false;
  const descActions = h('div', { class: 'mt-2.5 hidden items-center justify-end gap-2' });
  const descCancel = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cancel');
  const descSave = h('button', { class: 'btn btn-primary btn-sm px-4', type: 'button' }, 'Save');
  descActions.append(descCancel, descSave);

  const updateDescDirty = () => {
    const dirty = description.value !== ticket.description;
    descActions.classList.toggle('hidden', !dirty);
    descActions.classList.toggle('flex', dirty);
  };

  description.addEventListener('input', () => {
    autosize(description);
    updateDescDirty();
  });

  descCancel.addEventListener('click', () => {
    description.value = ticket.description;
    autosize(description);
    updateDescDirty();
  });

  const saveDescription = async () => {
    if (description.value === ticket.description || isSavingDescription) return;
    isSavingDescription = true;
    descSave.disabled = true;
    descCancel.disabled = true;
    try {
      await commit({ description: description.value });
      updateDescDirty();
    } finally {
      isSavingDescription = false;
      descSave.disabled = false;
      descCancel.disabled = false;
    }
  };

  descSave.addEventListener('click', () => void saveDescription());

  description.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void saveDescription();
    } else if (event.key === 'Escape' && description.value !== ticket.description) {
      event.preventDefault();
      event.stopPropagation();
      description.value = ticket.description;
      autosize(description);
      updateDescDirty();
    }
  });

  // ── Archive actions & activity ──
  const actions = h('div', {});
  const activity = h('ol', { class: 'relative space-y-4' });

  function renderActions(): void {
    if (locked()) {
      const restore = h('button', { class: 'btn btn-sm btn-primary', type: 'button' }, icon('restore', 14), 'Restore to board');
      restore.addEventListener('click', async () => {
        restore.disabled = true;
        const updated = await deps.restore(ticket);
        if (updated) ticket = updated;
        sync();
        void loadEvents();
      });
      replace(
        actions,
        h('div', { class: 'flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-4 py-3' }, h('p', { class: 'text-sm text-ink-2' }, `Archived ${timeAgo(ticket.archivedAt ?? Date.now())}. Restore it to make changes.`), restore),
      );
    } else if (ticket.status === 'done') {
      const archive = h('button', { class: 'btn btn-sm', type: 'button' }, icon('archive', 14), 'Archive ticket');
      archive.addEventListener('click', async () => {
        archive.disabled = true;
        const updated = await deps.archive(ticket);
        if (updated) {
          ticket = updated;
          deps.close();
        } else archive.disabled = false;
      });
      replace(actions, archive);
    } else replace(actions);
  }

  function sync(): void {
    if (document.activeElement !== title) title.value = ticket.title;
    if (document.activeElement !== description) {
      description.value = ticket.description;
      updateDescDirty();
    }
    statusSelect.value = ticket.status;
    prioritySelect.value = ticket.priority;
    assigneeSelect.value = ticket.assigneeId ?? '';
    for (const control of [title, description, statusSelect, prioritySelect, assigneeSelect, descSave, descCancel]) {
      control.disabled = locked();
    }
    replace(statusSlot, statusIcon(ticket.status, 16));
    replace(prioritySlot, priorityIcon(ticket.priority, 15));
    const assignee = deps.members.find((member) => member.id === ticket.assigneeId);
    replace(assigneeSlot, assignee ? avatar(assignee, 20) : h('span', { class: 'size-5 rounded-full border border-dashed border-line-strong' }));
    autosize(title);
    autosize(description);
    renderActions();
  }

  async function commit(patch: UpdateTicketBody): Promise<void> {
    const updated = await deps.update(ticket.id, patch);
    if (updated) ticket = updated;
    sync(); // on failure this snaps controls back to the last saved values
    void loadEvents();
  }

  function renderEvents(events: TicketEvent[]): void {
    replace(
      activity,
      ...events.map((event) => {
        const commentBox = event.comment
          ? h(
              'div',
              { class: 'mt-2 rounded-lg border border-line bg-surface/80 p-2.5 text-xs text-ink-2 leading-relaxed' },
              h('div', { class: 'mb-1 flex items-center gap-1 font-mono text-[10.5px] text-mute' }, icon('messageSquare', 12), 'Update note'),
              h('p', { class: 'whitespace-pre-wrap break-words italic text-ink' }, event.comment),
            )
          : null;

        return h(
          'li',
          { class: 'relative flex gap-3 pl-0' },
          event.actor ? avatar(event.actor, 20) : h('span', { class: 'size-5 shrink-0 rounded-full bg-line' }),
          h(
            'div',
            { class: 'min-w-0 flex-1' },
            h(
              'p',
              { class: 'min-w-0 text-sm text-ink-2' },
              h('span', { class: 'font-semibold text-ink' }, event.actor?.name ?? 'Someone'),
              ` ${describeEvent(event)} `,
              h('span', { class: 'whitespace-nowrap text-mute', title: new Date(event.createdAt).toLocaleString() }, `· ${timeAgo(event.createdAt)}`),
            ),
            commentBox,
          ),
        );
      }),
    );
  }

  async function loadEvents(): Promise<void> {
    try {
      renderEvents((await api.ticket(ticket.id)).events);
    } catch {
      replace(activity, h('li', { class: 'text-sm text-mute' }, 'Activity is unavailable right now.'));
    }
  }

  // ── Chrome ──
  const copyLink = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Copy link to this ticket' }, icon('link', 14), 'Copy link');
  copyLink.addEventListener('click', async () => {
    const ok = await copyText(`${location.origin}/p/${deps.project.id}?t=${ticket.id}`);
    toast(ok ? 'Link copied' : 'Could not copy the link', ok ? 'info' : 'error');
  });
  const closeButton = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', attrs: { 'aria-label': 'Close' } }, icon('x', 17));
  closeButton.addEventListener('click', deps.close);

  const panel = h(
    'aside',
    {
      class: 'animate-drawer fixed inset-y-0 right-0 z-50 flex w-[min(34rem,100vw)] flex-col border-l border-line-strong bg-surface shadow-[var(--shadow-lift)] outline-none',
      tabIndex: -1,
      attrs: { role: 'dialog', 'aria-label': 'Ticket details' },
    },
    h('div', { class: 'flex items-center justify-between border-b border-line px-5 py-3' }, h('span', { class: 'key-chip' }, ticketKey(deps.project.key, ticket)), h('div', { class: 'flex items-center gap-1' }, copyLink, closeButton)),
    h(
      'div',
      { class: 'flex-1 space-y-7 overflow-y-auto px-6 py-6' },
      title,
      h('div', { class: 'space-y-0.5' }, row('Status', statusSlot, statusSelect), row('Priority', prioritySlot, prioritySelect), row('Assignee', assigneeSlot, assigneeSelect)),
      h('div', {}, h('p', { class: 'eyebrow mb-2' }, 'Description'), description, descActions),
      actions,
      h('div', {}, h('p', { class: 'eyebrow mb-3' }, 'Activity'), activity),
    ),
  );

  const scrim = h('div', { class: 'scrim animate-fade', on: { click: deps.close } });
  const el = h('div', {}, scrim, panel);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') deps.close();
  };
  document.addEventListener('keydown', onKey);

  sync();
  void loadEvents();
  queueMicrotask(() => panel.focus());

  return { el, destroy: () => document.removeEventListener('keydown', onKey) };
}
