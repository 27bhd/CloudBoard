import { INVITE_DURATIONS_HOURS, type InviteDurationHours, type InviteSummary } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { h, replace } from '../lib/dom';
import { copyText, timeLeft } from '../lib/format';
import { toast } from '../lib/toast';
import { dropdown } from './dropdown';
import { icon } from './icons';

const DURATION_LABEL: Record<InviteDurationHours, string> = { 24: '24 hours', 48: '48 hours', 168: '7 days' };

/** Owner-only "Invite" button with a one-step popover: pick a lifetime, get a link on the clipboard. */
export function inviteButton(projectId: string): HTMLElement {
  const trigger = h('button', { class: 'btn btn-sm', type: 'button' }, icon('link', 15), 'Invite');

  return dropdown(trigger, {
    panel: () => {
      let hours: InviteDurationHours = 24;
      const result = h('div', {});
      const active = h('div', {});

      const refresh = async () => {
        try {
          const invites = await api.invites(projectId);
          renderActive(invites);
        } catch {
          replace(active);
        }
      };

      const renderActive = (invites: InviteSummary[]) => {
        if (invites.length === 0) return replace(active);
        replace(
          active,
          h('div', { class: 'mt-4 border-t border-line pt-3' }, h('p', { class: 'eyebrow mb-1.5' }, 'Active links'), ...invites.map(inviteRow)),
        );
      };

      const inviteRow = (invite: InviteSummary) => {
        const revoke = h('button', { class: 'btn btn-ghost btn-sm !px-2 text-mute hover:!text-accent', type: 'button' }, 'Revoke');
        revoke.addEventListener('click', async () => {
          revoke.disabled = true;
          try {
            await api.revokeInvite(projectId, invite.id);
            void refresh();
          } catch (error) {
            revoke.disabled = false;
            toast(error instanceof ApiError ? error.message : 'Could not revoke', 'error');
          }
        });
        return h('div', { class: 'flex items-center justify-between py-0.5 text-sm' }, h('span', { class: 'text-ink-2' }, `Expires in ${timeLeft(invite.expiresAt)}`), revoke);
      };

      const segmented = h(
        'div',
        { class: 'segmented', attrs: { role: 'group', 'aria-label': 'Link lifetime' } },
        ...INVITE_DURATIONS_HOURS.map((value) => {
          const button = h('button', { type: 'button', attrs: { 'aria-pressed': String(value === hours) } }, DURATION_LABEL[value]);
          button.addEventListener('click', () => {
            hours = value;
            segmented.querySelectorAll('button').forEach((el) => el.setAttribute('aria-pressed', String(el === button)));
          });
          return button;
        }),
      );

      const create = h('button', { class: 'btn btn-primary mt-3 w-full', type: 'button' }, 'Create link');
      create.addEventListener('click', async () => {
        create.disabled = true;
        try {
          const invite = await api.createInvite(projectId, { hours });
          const url = `${location.origin}/join/${invite.token}`;
          const field = h('input', { class: 'input font-mono !text-xs', readOnly: true, value: url });
          const copy = h('button', { class: 'btn btn-sm shrink-0', type: 'button' }, icon('copy', 14), 'Copy');
          const doCopy = async () => {
            const ok = await copyText(url);
            copy.replaceChildren(icon(ok ? 'check' : 'copy', 14), ok ? 'Copied' : 'Copy');
          };
          copy.addEventListener('click', doCopy);
          field.addEventListener('focus', () => field.select());
          replace(
            result,
            h('div', { class: 'animate-pop mt-3 flex items-center gap-2' }, field, copy),
            h('p', { class: 'mt-2 text-xs text-mute' }, `Anyone who signs in with this link joins instantly. Expires in ${DURATION_LABEL[hours]}.`),
          );
          void doCopy();
          void refresh();
        } catch (error) {
          toast(error instanceof ApiError ? error.message : 'Could not create the link', 'error');
        } finally {
          create.disabled = false;
        }
      });

      void refresh();
      return h(
        'div',
        { class: 'w-[min(22rem,calc(100vw-2.5rem))] p-4' },
        h('h3', { class: 'font-display text-xl' }, 'Invite people'),
        h('p', { class: 'mt-1 mb-3 text-sm text-ink-2' }, 'Share a link that expires on its own.'),
        segmented,
        create,
        result,
        active,
      );
    },
  });
}
