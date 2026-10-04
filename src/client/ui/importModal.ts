import { PRIORITIES, STATUSES, type BulkImportTicketItem, type Ticket } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { copyText } from '../lib/format';
import { toast } from '../lib/toast';
import { icon } from './icons';

const SAMPLE_JSON = JSON.stringify(
  [
    {
      title: 'Setup production health check endpoint',
      description: 'Add /api/health to monitor worker uptime and D1 latency.',
      status: 'todo',
      priority: 'high',
    },
    {
      title: 'Audit third-party frontend dependencies',
      description: 'Verify bundle sizes and ensure zero bloat.',
      status: 'backlog',
      priority: 'medium',
    },
  ],
  null,
  2,
);

export interface ImportModalOptions {
  projectId: string;
  onImported: (tickets: Ticket[]) => void;
}

/**
 * Developer-focused dialog to batch import tickets from a JSON payload or file.
 */
export function openImportModal(options: ImportModalOptions): void {
  let isSubmitting = false;
  let parsedTickets: BulkImportTicketItem[] = [];

  const textarea = h('textarea', {
    class: 'input !h-56 w-full resize-y font-mono !py-3 !text-xs leading-relaxed',
    placeholder: SAMPLE_JSON,
    spellcheck: false,
    attrs: { 'aria-label': 'JSON payload' },
  });

  const previewBox = h('div', { class: 'min-h-8 rounded-lg border border-line bg-raised/60 px-3 py-2 text-xs text-ink-2' });
  const submitBtn = h('button', { class: 'btn btn-primary btn-sm px-4', type: 'submit', disabled: true }, 'Import tickets');
  const cancelBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cancel');

  const updateValidation = () => {
    const raw = textarea.value.trim();
    if (!raw) {
      parsedTickets = [];
      submitBtn.disabled = true;
      submitBtn.textContent = 'Import tickets';
      replace(
        previewBox,
        h('p', { class: 'text-mute' }, 'Paste a JSON array of tickets (up to 200 items). Supported fields: title, description, status, priority.'),
      );
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed.tickets;
      if (!Array.isArray(list)) {
        throw new Error('Expected a top-level JSON array of ticket objects');
      }
      if (list.length === 0) {
        throw new Error('Array contains 0 items');
      }
      if (list.length > 200) {
        throw new Error(`Maximum 200 tickets per batch (found ${list.length})`);
      }

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object') throw new Error(`Item #${i + 1} is not an object`);
        if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
          throw new Error(`Item #${i + 1} is missing a required "title"`);
        }
      }

      parsedTickets = list.map((item) => ({
        title: String(item.title).trim(),
        description: item.description ? String(item.description) : '',
        status: item.status && (STATUSES as readonly string[]).includes(item.status) ? item.status : 'backlog',
        priority: item.priority && (PRIORITIES as readonly string[]).includes(item.priority) ? item.priority : 'none',
      }));

      const counts: Record<string, number> = {};
      for (const t of parsedTickets) {
        const key = t.status ?? 'backlog';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      const breakdown = Object.entries(counts)
        .map(([st, c]) => `${c} ${st.replace('_', ' ')}`)
        .join(', ');

      submitBtn.disabled = false;
      submitBtn.textContent = `Import ${parsedTickets.length} ticket${parsedTickets.length === 1 ? '' : 's'}`;
      replace(
        previewBox,
        h(
          'p',
          { class: 'font-medium text-ink' },
          h('span', { class: 'text-accent mr-1.5 font-bold' }, '✓'),
          `Ready to import ${parsedTickets.length} ticket${parsedTickets.length === 1 ? '' : 's'} (${breakdown})`,
        ),
      );
    } catch (error) {
      parsedTickets = [];
      submitBtn.disabled = true;
      submitBtn.textContent = 'Import tickets';
      const msg = error instanceof Error ? error.message : 'Invalid JSON format';
      replace(previewBox, h('p', { class: 'text-accent font-medium' }, `Syntax error: ${msg}`));
    }
  };

  textarea.addEventListener('input', updateValidation);

  // File upload trigger
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' }) as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result ?? '');
      updateValidation();
    };
    reader.readAsText(file);
  });

  const uploadFileBtn = h('button', { class: 'btn btn-ghost btn-sm text-xs', type: 'button' }, icon('upload', 13), 'Upload file');
  uploadFileBtn.addEventListener('click', () => fileInput.click());

  const copyTemplateBtn = h('button', { class: 'btn btn-ghost btn-sm text-xs', type: 'button' }, icon('copy', 13), 'Copy template');
  copyTemplateBtn.addEventListener('click', async () => {
    const ok = await copyText(SAMPLE_JSON);
    toast(ok ? 'JSON template copied to clipboard' : 'Could not copy template', ok ? 'info' : 'error');
  });

  const clearBtn = h('button', { class: 'btn btn-ghost btn-sm text-xs text-mute hover:text-ink', type: 'button' }, 'Clear');
  clearBtn.addEventListener('click', () => {
    textarea.value = '';
    updateValidation();
  });

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !submitBtn.disabled) {
      event.preventDefault();
      void doSubmit();
    }
  };

  cancelBtn.addEventListener('click', close);

  const doSubmit = async () => {
    if (isSubmitting || parsedTickets.length === 0) return;
    isSubmitting = true;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    textarea.disabled = true;

    try {
      const res = await api.importTickets(options.projectId, parsedTickets);
      toast(`Successfully imported ${res.count} ticket${res.count === 1 ? '' : 's'}`);
      options.onImported(res.tickets);
      close();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Failed to import tickets', 'error');
      isSubmitting = false;
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
      textarea.disabled = false;
    }
  };

  const form = h(
    'form',
    { class: 'space-y-4' },
    h(
      'div',
      {},
      h(
        'div',
        { class: 'mb-2 flex items-center justify-between' },
        h('span', { class: 'eyebrow' }, 'JSON payload'),
        h('div', { class: 'flex items-center gap-1.5' }, copyTemplateBtn, uploadFileBtn, clearBtn),
      ),
      textarea,
    ),
    previewBox,
    h('div', { class: 'flex items-center justify-end gap-2 pt-2' }, cancelBtn, submitBtn),
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void doSubmit();
  });

  const closeBtn = h('button', { class: 'btn btn-ghost btn-icon btn-sm text-mute hover:text-ink', type: 'button', attrs: { 'aria-label': 'Close dialog' } }, icon('x', 16));
  closeBtn.addEventListener('click', close);

  const modal = h(
    'div',
    {
      class: 'relative z-50 w-[min(38rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-surface p-6 shadow-[var(--shadow-lift)] animate-pop',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'import-modal-title' },
    },
    h(
      'div',
      { class: 'mb-4 flex items-start justify-between gap-3' },
      h(
        'div',
        { class: 'min-w-0' },
        h('h3', { id: 'import-modal-title', class: 'font-display text-xl leading-tight' }, 'Import tickets from JSON'),
        h('p', { class: 'mt-1 text-xs text-ink-2' }, 'Migrate tasks from existing trackers or import batch requirements with zero friction.'),
      ),
      closeBtn,
    ),
    fileInput,
    form,
  );

  const scrim = h('div', { class: 'scrim animate-fade' });
  scrim.addEventListener('click', close);

  const overlay = h('div', { class: 'fixed inset-0 z-50 grid place-items-center p-4' }, scrim, modal);
  document.addEventListener('keydown', onKeyDown);
  document.body.append(overlay);
  updateValidation();
  queueMicrotask(() => textarea.focus());
}
