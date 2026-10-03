import { STATUS_LABEL, type Status } from '../../shared/types';
import { h } from '../lib/dom';
import { icon, statusIcon } from './icons';

export interface StatusPromptOptions {
  ticketTitle: string;
  fromStatus: Status;
  toStatus: Status;
}

/**
 * Prompts the user for a mandatory note before changing ticket status.
 * Resolves with the trimmed comment string, or null if the action was cancelled.
 */
export function promptStatusComment(options: StatusPromptOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;

    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const textarea = h('textarea', {
      class: 'input !h-28 w-full resize-none !py-2.5 text-sm leading-relaxed',
      placeholder: 'Explain the reason for this status change (required)...',
      maxLength: 2000,
      attrs: { 'aria-label': 'Status change note', required: 'true' },
    });

    const submitBtn = h('button', { class: 'btn btn-primary btn-sm px-4', type: 'submit', disabled: true }, 'Update status');
    const cancelBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cancel');

    textarea.addEventListener('input', () => {
      submitBtn.disabled = textarea.value.trim().length === 0;
    });

    cancelBtn.addEventListener('click', () => finish(null));

    const form = h(
      'form',
      { class: 'space-y-4' },
      h(
        'div',
        {},
        h('label', { class: 'eyebrow mb-1.5 block' }, 'Status comment *'),
        textarea,
        h('p', { class: 'mt-1.5 text-xs text-mute' }, 'A status comment is required to keep team progress transparent.'),
      ),
      h('div', { class: 'flex items-center justify-end gap-2 pt-2' }, cancelBtn, submitBtn),
    );

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const val = textarea.value.trim();
      if (!val) return;
      finish(val);
    });

    const closeBtn = h('button', { class: 'btn btn-ghost btn-icon btn-sm text-mute hover:text-ink', type: 'button', attrs: { 'aria-label': 'Close dialog' } }, icon('x', 16));
    closeBtn.addEventListener('click', () => finish(null));

    const modal = h(
      'div',
      {
        class: 'relative z-50 w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-surface p-6 shadow-[var(--shadow-lift)] animate-pop',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'status-modal-title' },
      },
      h(
        'div',
        { class: 'mb-4 flex items-start justify-between gap-3' },
        h(
          'div',
          { class: 'min-w-0' },
          h('h3', { id: 'status-modal-title', class: 'font-display text-xl leading-tight' }, 'Change status'),
          h('p', { class: 'mt-1 truncate text-xs text-mute font-medium' }, options.ticketTitle),
        ),
        closeBtn,
      ),
      h(
        'div',
        { class: 'mb-4 flex items-center gap-2 rounded-xl border border-line bg-raised/80 px-3 py-2 text-xs font-medium' },
        h('span', { class: 'flex items-center gap-1.5 text-ink-2' }, statusIcon(options.fromStatus, 14), STATUS_LABEL[options.fromStatus]),
        h('span', { class: 'text-mute' }, icon('arrowRight', 12)),
        h('span', { class: 'flex items-center gap-1.5 font-semibold text-ink' }, statusIcon(options.toStatus, 14), STATUS_LABEL[options.toStatus]),
      ),
      form,
    );

    const scrim = h('div', { class: 'scrim animate-fade' });
    scrim.addEventListener('click', () => finish(null));

    const overlay = h('div', { class: 'fixed inset-0 z-50 grid place-items-center p-4' }, scrim, modal);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const val = textarea.value.trim();
        if (val) finish(val);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.append(overlay);
    queueMicrotask(() => textarea.focus());
  });
}
