import type { User } from '../../shared/types';
import { h } from '../lib/dom';

/** Palette for initials fallbacks: deterministic per login so a person is always the same colour. */
const TONES = ['#b5532f', '#8a6d1f', '#4d7a52', '#2f6f78', '#5b5a9a', '#8a4f7e', '#a0463c', '#5a6b3a'] as const;

function toneFor(login: string): string {
  let hash = 0;
  for (const char of login) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length] ?? TONES[0];
}

export function avatar(user: Pick<User, 'login' | 'name' | 'avatarUrl'>, size = 24): HTMLElement {
  const initials = h(
    'span',
    {
      class: 'inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none',
      title: user.name,
    },
    (user.name || user.login).slice(0, 1).toUpperCase(),
  );
  initials.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.44)}px;background:${toneFor(user.login)}`;
  if (!user.avatarUrl) return initials;

  const image = h('img', {
    src: `${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}s=${size * 2}`,
    alt: user.name,
    title: user.name,
    loading: 'lazy',
    class: 'shrink-0 rounded-full bg-line object-cover',
    width: size,
    height: size,
  });
  image.style.cssText = `width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;max-width:${size}px;max-height:${size}px`;
  image.addEventListener('error', () => image.replaceWith(initials), { once: true });
  return image;
}

export function avatarStack(users: User[], max = 4, size = 26): HTMLElement {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  const badge = (count: number) => {
    const el = h('span', { class: 'z-10 inline-grid place-items-center rounded-full bg-line-strong text-[11px] font-semibold text-ink-2 ring-2 ring-bg', title: `${count} more` }, `+${count}`);
    el.style.cssText = `width:${size}px;height:${size}px`;
    return el;
  };
  return h(
    'div',
    { class: 'flex items-center -space-x-2' },
    ...shown.map((user) => h('span', { class: 'rounded-full ring-2 ring-bg' }, avatar(user, size))),
    extra > 0 ? badge(extra) : null,
  );
}
