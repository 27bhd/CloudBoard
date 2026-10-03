import type { ProjectSummary } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { session } from '../session';
import { githubMark, icon } from '../ui/icons';

function greeting(): string {
  const hour = new Date().getHours();
  const part = hour < 5 ? 'Burning the midnight oil' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = (session.user?.name ?? '').split(' ')[0];
  return first ? `${part}, ${first}` : part;
}

function createForm(autofocus: boolean, large: boolean): HTMLFormElement {
  const input = h('input', {
    class: `input ${large ? 'h-12 text-base' : ''}`,
    placeholder: 'Name your project…',
    maxLength: 60,
    required: true,
    autocomplete: 'off',
    name: 'name',
  });
  const submit = h('button', { class: `btn btn-accent shrink-0 ${large ? 'h-12 px-5' : ''}`, type: 'submit' }, 'Create');
  const form = h('form', { class: 'flex gap-2' }, input, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    submit.disabled = true;
    try {
      const project = await api.createProject({ name });
      navigate(`/p/${project.id}`); // straight into the board — no intermediate "created!" screen
    } catch (error) {
      submit.disabled = false;
      toast(error instanceof ApiError ? error.message : 'Could not create the project', 'error');
    }
  });
  if (autofocus) queueMicrotask(() => input.focus());
  return form;
}

function projectCard(project: ProjectSummary, index: number): HTMLElement {
  const card = h(
    'a',
    {
      href: `/p/${project.id}`,
      class:
        'surface animate-rise group relative flex min-h-44 flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--shadow-lift)]',
    },
    h(
      'div',
      {},
      h(
        'div',
        { class: 'mb-4 flex items-center justify-between' },
        h('span', { class: 'key-chip' }, project.key),
        project.role === 'owner' ? h('span', { class: 'eyebrow !text-accent' }, 'Owner') : h('span', { class: 'eyebrow' }, 'Member'),
      ),
      h('h2', { class: 'font-display text-[1.6rem] leading-tight' }, project.name),
      project.description ? h('p', { class: 'mt-2 line-clamp-2 text-sm text-ink-2' }, project.description) : null,
    ),
    h(
      'div',
      { class: 'mt-6 flex items-center justify-between font-mono text-[11px] text-mute' },
      h('span', {}, `${project.openCount} open · ${project.memberCount} ${project.memberCount === 1 ? 'member' : 'members'}`),
      h('span', { class: 'translate-x-[-4px] text-ink opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100' }, icon('arrowRight', 16)),
    ),
  );
  card.style.animationDelay = `${index * 45}ms`;
  return card;
}

function emptyState(): HTMLElement {
  const ghostColumn = (tilt: number, cards: number) => {
    const col = h(
      'div',
      { class: 'w-24 rounded-xl border border-dashed border-line-strong p-2' },
      h('div', { class: 'mb-2 h-2 w-10 rounded-full bg-line-strong' }),
      ...Array.from({ length: cards }, () => h('div', { class: 'mb-1.5 h-8 rounded-md border border-dashed border-line' })),
    );
    col.style.transform = `rotate(${tilt}deg)`;
    return col;
  };
  return h(
    'div',
    { class: 'animate-rise mx-auto flex max-w-xl flex-col items-center px-2 pt-10 text-center' },
    h('div', { class: 'mb-9 flex items-end gap-3', attrs: { 'aria-hidden': 'true' } }, ghostColumn(-4, 1), ghostColumn(0, 2), ghostColumn(4, 0)),
    h('h2', { class: 'font-display text-4xl leading-tight' }, 'A blank board is a promise.'),
    h('p', { class: 'mt-3 mb-8 text-ink-2' }, 'Name your first project and you’ll land straight in it. Invite teammates whenever you’re ready.'),
    h('div', { class: 'w-full max-w-md' }, createForm(true, true)),
  );
}

export function projectsPage(outlet: HTMLElement): void {
  const content = h('div', {}, h('div', { class: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' }, ...[0, 1, 2].map(() => h('div', { class: 'skeleton h-44' }))));
  outlet.append(
    h(
      'div',
      { class: 'mx-auto w-full max-w-6xl px-5 py-10 sm:px-8' },
      h('p', { class: 'eyebrow mb-2' }, greeting()),
      h('h1', { class: 'mb-9 font-display text-5xl tracking-tight' }, 'Projects'),
      content,
      h(
        'footer',
        { class: 'mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-mute' },
        h(
          'a',
          {
            href: 'https://github.com/27bhd/CloudBoard',
            target: '_blank',
            rel: 'noreferrer',
            class: 'inline-flex items-center gap-1.5 transition-colors hover:text-ink',
          },
          githubMark(14),
          'github.com/27bhd/CloudBoard',
          icon('arrowRight', 12),
        ),
        h('span', {}, 'CloudBoard · 100% Open Source (MIT) · Edge-native on Cloudflare D1'),
      ),
    ),
  );

  void api.listProjects().then(
    (projects) => {
      if (projects.length === 0) return replace(content, emptyState());
      const newCard = h('div', { class: 'animate-rise flex min-h-44 flex-col justify-center rounded-[0.9rem] border border-dashed border-line-strong p-5' }, h('p', { class: 'eyebrow mb-3' }, 'New project'), createForm(false, false));
      replace(content, h('div', { class: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' }, ...projects.map(projectCard), newCard));
    },
    (error: unknown) => {
      replace(content, h('p', { class: 'text-ink-2' }, error instanceof ApiError ? error.message : 'Could not load your projects.'));
    },
  );
}
