import { h } from '../lib/dom';
import { githubMark, icon, logoMark } from '../ui/icons';
import { session } from '../session';

const REPO_URL = 'https://github.com/27bhd/CloudBoard';

export const githubSignInUrl = (next: string): string => `/api/auth/github?next=${encodeURIComponent(next)}`;

export function githubButton(next: string, className = 'btn btn-primary h-11 px-5 text-[0.95rem]'): HTMLAnchorElement {
  return h('a', { class: className, href: githubSignInUrl(next) }, githubMark(18), 'Continue with GitHub');
}

/** Offline sign-in, only rendered when the API says DEV_AUTH is on (localhost). */
export function devSignIn(next: string): HTMLElement {
  const input = h('input', { class: 'input', name: 'login', placeholder: 'pick a username', autocomplete: 'off', required: true, maxLength: 32 });
  return h(
    'form',
    { class: 'mt-8 max-w-sm rounded-xl border border-dashed border-line-strong p-4', method: 'get', action: '/api/auth/dev' },
    h('p', { class: 'eyebrow mb-2' }, 'Local dev sign-in'),
    h('div', { class: 'flex gap-2' }, input, h('button', { class: 'btn btn-accent shrink-0', type: 'submit' }, 'Enter')),
    h('input', { type: 'hidden', name: 'next', value: next }),
    h('p', { class: 'mt-2 text-xs text-mute' }, 'Works offline. Not available on the hosted site.'),
  );
}

const PREVIEW_COLUMNS: { status: 'todo' | 'in_progress' | 'review'; label: string; cards: [string, string, string][] }[] = [
  { status: 'todo', label: 'Todo', cards: [['CB-14', 'Rate-limit the invite endpoint', 'high'], ['CB-17', 'Empty states, but nicer', 'none']] },
  { status: 'in_progress', label: 'In progress', cards: [['CB-12', 'Ship the archive view', 'urgent'], ['CB-15', 'Drag between columns', 'medium']] },
  { status: 'review', label: 'Review', cards: [['CB-9', 'GitHub sign-in, no libraries', 'low']] },
];

/** A decorative, non-interactive miniature of the real board. */
function previewBoard(): HTMLElement {
  const dot: Record<string, string> = { todo: 'bg-s-todo', in_progress: 'bg-s-progress', review: 'bg-s-review' };
  return h(
    'div',
    { class: 'pointer-events-none flex gap-3 select-none', attrs: { 'aria-hidden': 'true' } },
    ...PREVIEW_COLUMNS.map((column, index) => {
      const col = h(
        'div',
        { class: 'animate-rise w-48 shrink-0 rounded-2xl border border-line bg-surface p-2.5' },
        h('div', { class: 'mb-2.5 flex items-center gap-2 px-1 text-[13px] font-semibold' }, h('span', { class: `size-2 rounded-full ${dot[column.status]}` }), column.label),
        ...column.cards.map(([key, title, priority]) =>
          h(
            'div',
            { class: 'mb-2 rounded-lg border border-line bg-raised p-2.5 shadow-sm' },
            h('div', { class: 'mb-1 flex items-center justify-between' }, h('span', { class: 'font-mono text-[10px] text-mute' }, key), priority === 'urgent' ? h('span', { class: 'size-3 rounded-[4px] bg-accent' }) : null),
            h('div', { class: 'text-[13px] leading-snug font-medium' }, title),
          ),
        ),
      );
      col.style.animationDelay = `${index * 90 + 150}ms`;
      col.style.marginTop = `${index === 1 ? 0 : index === 0 ? 28 : 56}px`;
      return col;
    }),
  );
}

export function loginPage(outlet: HTMLElement): void {
  const next = new URLSearchParams(location.search).get('next') ?? '/';
  const art = h('div', { class: 'relative hidden items-center justify-center overflow-hidden border-l border-line bg-surface/60 lg:flex' }, previewBoard());
  outlet.append(
    h(
      'div',
      { class: 'grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]' },
      h(
        'section',
        { class: 'animate-rise flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-20' },
        h('span', { class: 'inline-flex items-center gap-2.5 font-display text-xl' }, logoMark(28), 'CloudBoard'),
        h(
          'div',
          { class: 'py-16' },
          h('p', { class: 'eyebrow mb-5' }, 'Free · Open source · Edge-native'),
          h('h1', { class: 'font-display text-[clamp(3rem,7vw,5.5rem)] leading-[0.98] tracking-tight' }, 'It just ', h('span', { class: 'text-accent' }, 'works.')),
          h('p', { class: 'mt-6 max-w-md text-[1.05rem] text-ink-2' }, 'A project tracker that gets out of your way. Sign in, name a project, start moving cards. No setup, no seats, no ceremony.'),
          h('div', { class: 'mt-9 flex flex-wrap items-center gap-4' }, githubButton(next), h('span', { class: 'text-sm text-mute' }, 'Takes about four seconds.')),
          session.devAuth ? devSignIn(next) : null,
        ),
        h(
          'footer',
          { class: 'flex items-center gap-5 text-sm text-mute' },
          h('a', { class: 'inline-flex items-center gap-1.5 transition-colors hover:text-ink', href: REPO_URL, target: '_blank', rel: 'noreferrer' }, githubMark(15), 'Source on GitHub', icon('arrowRight', 13)),
          h('span', {}, 'MIT licensed'),
        ),
      ),
      art,
    ),
  );
}
