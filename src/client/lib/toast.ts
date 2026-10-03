import { h } from './dom';

type Kind = 'info' | 'error';

let host: HTMLElement | null = null;

/** Non-blocking feedback. Errors stay a little longer. */
export function toast(message: string, kind: Kind = 'info'): void {
  if (!host) {
    host = h('div', { class: 'fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 px-4', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.appendChild(host);
  }
  const el = h(
    'div',
    {
      class: `animate-pop flex max-w-sm items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-lift)] ${
        kind === 'error' ? 'border-accent bg-raised text-ink' : 'border-line-strong bg-ink text-bg'
      }`,
    },
    kind === 'error' ? h('span', { class: 'size-2 shrink-0 rounded-full bg-accent' }) : null,
    message,
  );
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, kind === 'error' ? 4200 : 2200);
}
