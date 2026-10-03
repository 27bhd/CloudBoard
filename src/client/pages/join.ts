import type { InvitePreview } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { session } from '../session';
import { githubButton, devSignIn } from './login';
import { icon } from '../ui/icons';

/** A centred status card used for every invite outcome. */
function card(tone: 'ok' | 'warn', title: string, body: string, ...actions: HTMLElement[]): HTMLElement {
  return h(
    'div',
    { class: 'surface animate-rise w-full max-w-md p-8 text-center shadow-[var(--shadow)]' },
    h(
      'div',
      { class: `mx-auto mb-5 grid size-12 place-items-center rounded-full ${tone === 'ok' ? 'bg-accent-soft text-accent' : 'bg-line text-ink-2'}` },
      icon(tone === 'ok' ? 'users' : 'link', 22),
    ),
    h('h1', { class: 'font-display text-3xl leading-tight' }, title),
    h('p', { class: 'mt-3 mb-7 text-ink-2' }, body),
    h('div', { class: 'flex flex-col items-center gap-3' }, ...actions),
  );
}

const homeLink = (label = 'Go to your projects') => h('a', { class: 'btn', href: '/' }, label);

export function joinPage(outlet: HTMLElement, params: Record<string, string>): void {
  const token = params['token'] ?? '';
  const stage = h('div', { class: 'grid min-h-[calc(100dvh-3.5rem)] place-items-center px-5 py-10' }, h('div', { class: 'skeleton h-64 w-full max-w-md' }));
  outlet.append(stage);
  const show = (node: HTMLElement) => replace(stage, node);

  const render = (invite: InvitePreview) => {
    const next = `/join/${token}`;
    if (invite.state === 'expired') {
      return show(card('warn', 'This invite has expired', `The link to ${invite.projectName} is no longer active. Ask ${invite.invitedBy} to send you a fresh one.`, homeLink()));
    }
    if (invite.state === 'member') {
      return show(card('ok', 'You’re already in', `You’re a member of ${invite.projectName}.`, h('a', { class: 'btn btn-primary', href: '/' }, 'Open your projects')));
    }
    if (!session.user) {
      const actions: HTMLElement[] = [githubButton(next, 'btn btn-primary h-11 w-full')];
      if (session.devAuth) actions.push(devSignIn(next));
      return show(card('ok', `Join ${invite.projectName}`, `${invite.invitedBy} invited you. Sign in with GitHub and you’ll be added instantly.`, ...actions));
    }
    const join = h('button', { class: 'btn btn-accent h-11 w-full', type: 'button' }, `Join ${invite.projectName}`);
    join.addEventListener('click', async () => {
      join.disabled = true;
      try {
        const { projectId } = await api.acceptInvite(token);
        navigate(`/p/${projectId}`);
      } catch (error) {
        join.disabled = false;
        if (error instanceof ApiError && error.status === 410) return show(card('warn', 'This invite has expired', 'It ran out just now. Ask for a fresh link.', homeLink()));
        toast(error instanceof ApiError ? error.message : 'Could not join', 'error');
      }
    });
    show(card('ok', `Join ${invite.projectName}`, `${invite.invitedBy} invited you to collaborate. This link works until ${new Date(invite.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.`, join));
  };

  void api.previewInvite(token).then(render, (error: unknown) => {
    const notFound = error instanceof ApiError && error.status === 404;
    show(card('warn', notFound ? 'This link isn’t valid' : 'Something went wrong', notFound ? 'It may have been revoked or mistyped. Double-check it, or ask for a new invite.' : 'We couldn’t check this invite. Try again in a moment.', homeLink()));
  });
}
