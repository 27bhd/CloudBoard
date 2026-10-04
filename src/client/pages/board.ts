import {
  STATUSES,
  STATUS_LABEL,
  type BoardResponse,
  type Member,
  type Status,
  type Ticket,
  type UpdateTicketBody,
} from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { sortColumn, ticketKey, timeAgo } from '../lib/format';
import { navigate, type Cleanup } from '../lib/router';
import { toast } from '../lib/toast';
import { requireSessionUser } from '../session';
import { avatar, avatarStack } from '../ui/avatar';
import { confirmButton, dropdown } from '../ui/dropdown';
import { ticketDrawer } from '../ui/drawer';
import { icon, priorityIcon, statusIcon } from '../ui/icons';
import { inviteButton } from '../ui/invite';
import { openImportModal } from '../ui/importModal';
import { promptStatusComment } from '../ui/statusModal';

const POSITION_STEP = 1024;
const isTemp = (ticket: Ticket): boolean => ticket.id.startsWith('tmp-');

export function boardPage(outlet: HTMLElement, params: Record<string, string>, view: 'board' | 'archive'): Cleanup {
  const projectId = params['id'] ?? '';
  const me = requireSessionUser();

  let data: BoardResponse | null = null;
  let archived: Ticket[] | null = null;
  let adding: Status | null = null;
  let draft = '';
  let drawer: ReturnType<typeof ticketDrawer> | null = null;
  let dragId: string | null = null;
  let dropLine: HTMLElement | null = null;

  const header = h('div', {});
  const body = h('div', { class: 'mt-6' });
  outlet.append(h('div', { class: 'mx-auto w-full max-w-[1800px] px-5 py-8 sm:px-8' }, header, body));
  replace(header, h('div', { class: 'skeleton h-24 max-w-md' }));
  replace(body, h('div', { class: 'flex gap-3' }, ...STATUSES.map(() => h('div', { class: 'skeleton h-72 flex-1' }))));

  const members = (): Map<string, Member> => new Map((data?.members ?? []).map((member) => [member.id, member]));

  // ───────────── Data actions (optimistic, with rollback) ─────────────

  async function updateTicket(id: string, patch: UpdateTicketBody): Promise<Ticket | null> {
    if (!data) return null;
    const before = data.tickets.find((ticket) => ticket.id === id);
    if (!before) return null;

    const next: UpdateTicketBody = { ...patch };
    if (patch.status && patch.status !== before.status && patch.position === undefined) {
      const column = sortColumn(data.tickets, patch.status);
      next.position = (column.at(-1)?.position ?? 0) + POSITION_STEP; // land at the bottom of the new column
    }
    const optimistic: Ticket = {
      ...before,
      ...next,
      assigneeId: next.assigneeId === undefined ? before.assigneeId : next.assigneeId,
      latestComment: next.statusComment !== undefined ? next.statusComment : before.latestComment,
    };
    apply(optimistic);
    try {
      const saved = await api.updateTicket(id, next);
      apply(saved);
      return saved;
    } catch (error) {
      apply(before);
      toast(error instanceof ApiError ? error.message : 'Could not save that change', 'error');
      return null;
    }
  }

  function apply(ticket: Ticket): void {
    if (!data) return;
    data.tickets = data.tickets.map((existing) => (existing.id === ticket.id ? ticket : existing));
    renderBoard();
  }

  async function addTicket(status: Status, title: string): Promise<void> {
    if (!data) return;
    const column = sortColumn(data.tickets, status);
    const temp: Ticket = {
      id: `tmp-${crypto.randomUUID()}`,
      projectId,
      number: 0,
      title,
      description: '',
      status,
      priority: 'none',
      assigneeId: null,
      creatorId: me.id,
      position: (column.at(-1)?.position ?? 0) + POSITION_STEP,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archivedAt: null,
      latestComment: null,
    };
    data.tickets.push(temp);
    renderBoard();
    try {
      const saved = await api.createTicket(projectId, { title, status });
      if (data) data.tickets = data.tickets.map((ticket) => (ticket.id === temp.id ? saved : ticket));
    } catch (error) {
      if (data) data.tickets = data.tickets.filter((ticket) => ticket.id !== temp.id);
      toast(error instanceof ApiError ? error.message : 'Could not create the ticket', 'error');
    }
    renderBoard();
  }

  async function archiveTicket(ticket: Ticket): Promise<Ticket | null> {
    try {
      const saved = await api.archiveTicket(ticket.id);
      if (data) data.tickets = data.tickets.filter((existing) => existing.id !== ticket.id);
      toast('Archived: find it under Archive');
      renderBoard();
      return saved;
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not archive', 'error');
      return null;
    }
  }

  async function restoreTicket(ticket: Ticket): Promise<Ticket | null> {
    try {
      const saved = await api.restoreTicket(ticket.id);
      archived = (archived ?? []).filter((existing) => existing.id !== ticket.id);
      data?.tickets.push(saved);
      toast('Restored to the board');
      renderArchive();
      return saved;
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not restore', 'error');
      return null;
    }
  }

  async function archiveAllDone(): Promise<void> {
    try {
      const { archived: count } = await api.archiveDone(projectId);
      if (data) data.tickets = data.tickets.filter((ticket) => ticket.status !== 'done');
      toast(count === 1 ? 'Archived 1 ticket' : `Archived ${count} tickets`);
      renderBoard();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not archive', 'error');
    }
  }

  // ───────────── Drawer ─────────────

  function openDrawer(ticket: Ticket): void {
    if (!data || isTemp(ticket)) return;
    closeDrawer(false);
    drawer = ticketDrawer({
      project: data.project,
      members: data.members,
      ticket,
      update: updateTicket,
      archive: archiveTicket,
      restore: restoreTicket,
      close: () => closeDrawer(true),
    });
    document.body.appendChild(drawer.el);
    history.replaceState(null, '', `${location.pathname}?t=${ticket.id}`);
  }

  function closeDrawer(updateUrl: boolean): void {
    if (!drawer) return;
    drawer.destroy();
    drawer.el.remove();
    drawer = null;
    if (updateUrl) history.replaceState(null, '', location.pathname);
  }

  // ───────────── Rendering ─────────────

  function renderHeader(): void {
    if (!data) return;
    const { project, role } = data;
    const menuTrigger = h('button', { class: 'btn btn-icon btn-sm', type: 'button', attrs: { 'aria-label': 'Project menu' } }, icon('more', 16));
    const menu = dropdown(menuTrigger, {
      panel: () =>
        h(
          'div',
          { class: 'w-64 p-3' },
          h('p', { class: 'eyebrow mb-2' }, 'Project'),
          role === 'owner'
            ? confirmButton('Delete project', 'Click again to delete forever', async () => {
                try {
                  await api.deleteProject(projectId);
                  toast('Project deleted');
                  navigate('/');
                } catch (error) {
                  toast(error instanceof ApiError ? error.message : 'Could not delete', 'error');
                }
              }, 'btn btn-sm btn-danger w-full')
            : confirmButton('Leave project', 'Click again to leave', async () => {
                try {
                  await api.leaveProject(projectId, me.id);
                  navigate('/');
                } catch (error) {
                  toast(error instanceof ApiError ? error.message : 'Could not leave', 'error');
                }
              }, 'btn btn-sm btn-danger w-full'),
        ),
    });

    const importBtn = h('button', { class: 'btn btn-sm', type: 'button', title: 'Import tickets from JSON' }, icon('upload', 14), 'Import');
    importBtn.addEventListener('click', () => {
      openImportModal({
        projectId,
        onImported: (newTickets) => {
          if (!data) return;
          data.tickets.push(...newTickets);
          renderBoard();
        },
      });
    });

    replace(
      header,
      h('a', { href: '/', class: 'mb-4 inline-flex items-center gap-1.5 text-sm text-mute transition-colors hover:text-ink' }, icon('arrowLeft', 14), 'Projects'),
      h(
        'div',
        { class: 'flex flex-wrap items-end justify-between gap-x-6 gap-y-4' },
        h(
          'div',
          { class: 'min-w-0' },
          h('div', { class: 'flex items-center gap-3' }, h('h1', { class: 'truncate font-display text-[2.5rem] leading-none tracking-tight' }, project.name), h('span', { class: 'key-chip mt-1.5' }, project.key)),
          project.description ? h('p', { class: 'mt-2 max-w-2xl text-sm text-ink-2' }, project.description) : null,
        ),
        h('div', { class: 'flex items-center gap-3' }, avatarStack(data.members), importBtn, role === 'owner' ? inviteButton(projectId) : null, menu),
      ),
      h(
        'nav',
        { class: 'mt-6 flex items-center gap-6 border-b border-line pb-2.5', attrs: { 'aria-label': 'Project views' } },
        h('a', { href: `/p/${projectId}`, class: 'tab', attrs: view === 'board' ? { 'aria-current': 'page' } : {} }, 'Board'),
        h('a', { href: `/p/${projectId}/archive`, class: 'tab', attrs: view === 'archive' ? { 'aria-current': 'page' } : {} }, 'Archive'),
      ),
    );
  }

  function ticketCard(ticket: Ticket): HTMLElement {
    const assignee = ticket.assigneeId ? members().get(ticket.assigneeId) : undefined;
    const pending = isTemp(ticket);

    const commentBlock = ticket.latestComment
      ? h(
          'div',
          { class: 'mt-2 rounded-md border border-line bg-surface/75 px-2 py-1.5 text-xs text-ink-2 shadow-2xs' },
          h('div', { class: 'mb-0.5 flex items-center gap-1 font-mono text-[10px] text-mute' }, icon('messageSquare', 11), 'Update note'),
          h('p', { class: 'line-clamp-2 italic leading-tight text-ink/90' }, `“${ticket.latestComment}”`),
        )
      : null;

    const el = h(
      'article',
      {
        class: `ticket-card ${pending ? 'is-pending' : ''}`,
        draggable: !pending,
        tabIndex: 0,
        attrs: { 'data-id': ticket.id },
      },
      h(
        'div',
        { class: 'mb-1.5 flex items-center justify-between gap-2' },
        h('span', { class: 'font-mono text-[10.5px] text-mute' }, pending && data ? `${data.project.key}-…` : data ? ticketKey(data.project.key, ticket) : ''),
        ticket.priority !== 'none' ? priorityIcon(ticket.priority, 13) : null,
      ),
      h('p', { class: 'line-clamp-3 text-[0.9rem] leading-snug font-medium break-words' }, ticket.title),
      commentBlock,
      assignee ? h('div', { class: 'mt-2.5 flex justify-end' }, avatar(assignee, 20)) : null,
    );
    el.addEventListener('click', () => openDrawer(ticket));
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target === el) openDrawer(ticket);
    });
    el.addEventListener('dragstart', (event) => {
      dragId = ticket.id;
      event.dataTransfer?.setData('text/plain', ticket.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('is-dragging'), 0); // after the browser snapshots the drag image
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      el.classList.remove('is-dragging');
      clearDropUi();
    });
    return el;
  }

  function dropIndex(list: HTMLElement, clientY: number): number {
    const cards = [...list.querySelectorAll<HTMLElement>('.ticket-card:not(.is-dragging)')];
    const index = cards.findIndex((card) => {
      const rect = card.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return index === -1 ? cards.length : index;
  }

  function showDropLine(list: HTMLElement, index: number): void {
    const cards = [...list.querySelectorAll<HTMLElement>('.ticket-card:not(.is-dragging)')];
    dropLine ??= h('div', { class: 'drop-line' });
    const before = cards[index] ?? null;
    if (dropLine.parentElement === list && dropLine.nextElementSibling === before) return;
    list.insertBefore(dropLine, before);
  }

  function clearDropUi(): void {
    dropLine?.remove();
    body.querySelectorAll('.column.is-over').forEach((el) => el.classList.remove('is-over'));
  }

  function moveTicket(id: string, status: Status, index: number): void {
    if (!data) return;
    const ticket = data.tickets.find((candidate) => candidate.id === id);
    if (!ticket) return;
    const target = sortColumn(data.tickets, status).filter((candidate) => candidate.id !== id);
    const prev = target[index - 1];
    const next = target[index];
    const position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + POSITION_STEP : next ? next.position / 2 : POSITION_STEP;
    if (ticket.status === status && position === ticket.position) return;

    if (ticket.status !== status) {
      void (async () => {
        const comment = await promptStatusComment({
          ticketTitle: ticket.title,
          fromStatus: ticket.status,
          toStatus: status,
        });
        if (comment === null) {
          renderBoard();
          return;
        }
        void updateTicket(id, { status, position, statusComment: comment });
      })();
    } else {
      void updateTicket(id, { status, position });
    }
  }

  function quickAdd(status: Status): HTMLElement {
    const input = h('input', { class: 'input !h-10 text-sm', placeholder: 'Ticket title, then Enter', maxLength: 200, value: draft, autocomplete: 'off', attrs: { 'aria-label': `New ticket in ${STATUS_LABEL[status]}` } });
    input.addEventListener('input', () => {
      draft = input.value;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        adding = null;
        draft = '';
        renderBoard();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const title = input.value.trim();
        if (!title) return;
        draft = ''; // stays open for rapid-fire entry
        void addTicket(status, title);
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim() === '' && adding === status) {
        adding = null;
        draft = '';
        setTimeout(renderBoard, 0);
      }
    });
    queueMicrotask(() => input.focus());
    return h('div', { class: 'animate-pop mb-2' }, input);
  }

  function column(status: Status, tickets: Ticket[]): HTMLElement {
    const items = sortColumn(tickets, status);
    const add = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: `Add to ${STATUS_LABEL[status]}`, attrs: { 'aria-label': `Add ticket to ${STATUS_LABEL[status]}` } }, icon('plus', 15));
    add.addEventListener('click', () => {
      adding = status;
      renderBoard();
    });
    const archiveAll = status === 'done' && items.length > 0 ? confirmButton('Archive all', 'Archive all?', () => void archiveAllDone(), 'btn btn-ghost btn-sm !px-2 text-mute') : null;

    const list = h('div', { class: 'flex min-h-20 flex-1 flex-col gap-2' }, adding === status ? quickAdd(status) : null, ...items.map(ticketCard));
    if (items.length === 0 && adding !== status) {
      list.append(h('div', { class: 'grid flex-1 place-items-center rounded-lg border border-dashed border-line py-8 text-center text-xs text-mute' }, status === 'done' ? 'Finished work lands here' : 'Drop a ticket here'));
    }

    const col = h(
      'section',
      { class: 'column surface flex min-h-[20rem] w-[82vw] shrink-0 snap-start flex-col p-2.5 transition-colors duration-150 sm:w-72 xl:w-auto xl:min-w-60 xl:flex-1' },
      h('header', { class: 'mb-2.5 flex items-center gap-2 px-1' }, statusIcon(status, 15), h('h2', { class: 'text-[0.9rem] font-semibold' }, STATUS_LABEL[status]), h('span', { class: 'font-mono text-[11px] text-mute' }, String(items.length)), h('span', { class: 'flex-1' }), archiveAll, add),
      list,
    );

    col.addEventListener('dragover', (event) => {
      if (!dragId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      col.classList.add('is-over');
      showDropLine(list, dropIndex(list, event.clientY));
    });
    col.addEventListener('dragleave', (event) => {
      if (!col.contains(event.relatedTarget as Node | null)) {
        col.classList.remove('is-over');
        if (dropLine?.parentElement === list) dropLine.remove();
      }
    });
    col.addEventListener('drop', (event) => {
      if (!dragId) return;
      event.preventDefault();
      const index = dropIndex(list, event.clientY);
      const id = dragId;
      dragId = null;
      clearDropUi();
      moveTicket(id, status, index);
    });
    return col;
  }

  function renderBoard(): void {
    if (!data || view !== 'board') return;
    const tickets = data.tickets;
    const hint =
      tickets.length === 0 && adding === null
        ? h('div', { class: 'animate-rise mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2' }, h('span', { class: 'font-display text-lg text-ink' }, 'A fresh board.'), 'Press', h('kbd', { class: 'kbd' }, 'C'), 'or hit + on any column to add your first ticket.')
        : null;
    replace(body, hint, h('div', { class: 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-6 sm:snap-none' }, ...STATUSES.map((status) => column(status, tickets))));
  }

  function renderArchive(): void {
    if (view !== 'archive') return;
    if (!archived) return replace(body, h('div', { class: 'skeleton h-48' }));
    if (archived.length === 0) {
      return replace(
        body,
        h(
          'div',
          { class: 'animate-rise mx-auto flex max-w-md flex-col items-center py-16 text-center' },
          h('div', { class: 'mb-5 grid size-14 place-items-center rounded-2xl border border-dashed border-line-strong text-mute' }, icon('archive', 24)),
          h('h2', { class: 'font-display text-3xl' }, 'Nothing archived yet'),
          h('p', { class: 'mt-2 mb-6 text-ink-2' }, 'Move tickets to Done, then archive them to keep the board tidy. They’ll rest here, one click from coming back.'),
          h('a', { class: 'btn', href: `/p/${projectId}` }, 'Back to the board'),
        ),
      );
    }
    const lookup = members();
    const rows = archived.map((ticket) => {
      const assignee = ticket.assigneeId ? lookup.get(ticket.assigneeId) : undefined;
      const restore = h('button', { class: 'btn btn-sm shrink-0', type: 'button' }, icon('restore', 14), 'Restore');
      restore.addEventListener('click', async (event) => {
        event.stopPropagation();
        restore.disabled = true;
        if (!(await restoreTicket(ticket))) restore.disabled = false;
      });
      const line = h(
        'div',
        { class: 'flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-raised', tabIndex: 0 },
        h('span', { class: 'w-20 shrink-0 font-mono text-[11px] text-mute' }, data ? ticketKey(data.project.key, ticket) : ''),
        h(
          'div',
          { class: 'min-w-0 flex-1' },
          h('p', { class: 'truncate font-medium' }, ticket.title),
          ticket.latestComment ? h('p', { class: 'truncate text-xs text-mute italic' }, `“${ticket.latestComment}”`) : null,
        ),
        assignee ? h('span', { class: 'hidden items-center gap-2 text-sm text-ink-2 sm:flex' }, avatar(assignee, 20), assignee.login) : null,
        h('span', { class: 'hidden w-24 shrink-0 text-right text-sm text-mute md:block' }, timeAgo(ticket.archivedAt ?? ticket.updatedAt)),
        restore,
      );
      line.addEventListener('click', () => openDrawer(ticket));
      line.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target === line) openDrawer(ticket);
      });
      return line;
    });
    replace(body, h('div', { class: 'surface animate-rise divide-y divide-line overflow-hidden' }, ...rows));
  }

  // ───────────── Keyboard ─────────────

  const onKey = (event: KeyboardEvent) => {
    if (view !== 'board' || event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey || drawer) return;
    const target = event.target as HTMLElement | null;
    if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
    event.preventDefault(); // keeps the "c" out of the input we're about to focus
    adding = 'todo';
    renderBoard();
  };
  document.addEventListener('keydown', onKey);

  // ───────────── Boot ─────────────

  void (async () => {
    try {
      const [board, archive] = await Promise.all([api.board(projectId), view === 'archive' ? api.archive(projectId) : Promise.resolve(null)]);
      data = board;
      archived = archive;
      document.title = `${board.project.name} · CloudBoard`;
      renderHeader();
      renderBoard();
      renderArchive();
      const wanted = new URLSearchParams(location.search).get('t');
      if (wanted) {
        const known = board.tickets.find((ticket) => ticket.id === wanted) ?? archive?.find((ticket) => ticket.id === wanted);
        if (known) openDrawer(known);
        else {
          try {
            openDrawer((await api.ticket(wanted)).ticket);
          } catch {
            history.replaceState(null, '', location.pathname);
          }
        }
      }
    } catch (error) {
      const missing = error instanceof ApiError && error.status === 404;
      replace(header);
      replace(
        body,
        h(
          'div',
          { class: 'mx-auto max-w-md py-20 text-center' },
          h('h1', { class: 'font-display text-4xl' }, missing ? 'Project not found' : 'Couldn’t load this board'),
          h('p', { class: 'mt-3 mb-6 text-ink-2' }, missing ? 'It may have been deleted, or you’re not a member.' : 'Check your connection and try again.'),
          h('a', { class: 'btn btn-primary', href: '/' }, 'Back to projects'),
        ),
      );
    }
  })();

  return () => {
    document.removeEventListener('keydown', onKey);
    closeDrawer(false);
    document.title = 'CloudBoard - It just works.';
  };
}
