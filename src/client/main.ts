import { api, setUnauthorizedHandler } from './lib/api';
import { h, replace } from './lib/dom';
import { defineRoute, navigate, setFallback, startRouter, type Page } from './lib/router';
import { boardPage } from './pages/board';
import { joinPage } from './pages/join';
import { loginPage } from './pages/login';
import { projectsPage } from './pages/projects';
import { session } from './session';
import { avatar } from './ui/avatar';
import { dropdown } from './ui/dropdown';
import { githubMark, icon, logoMark } from './ui/icons';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

const topbar = h('header', { class: 'sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md' });
const outlet = h('main', { id: 'outlet' });
app.append(topbar, outlet);

function themeToggle(): HTMLButtonElement {
  const button = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Toggle theme', attrs: { 'aria-label': 'Toggle theme' } });
  const paint = () => button.replaceChildren(icon(document.documentElement.dataset['theme'] === 'dark' ? 'sun' : 'moon', 17));
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset['theme'] === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('cb-theme', next);
    } catch {
      // storage can be blocked; the theme still applies for this session
    }
    paint();
  });
  paint();
  return button;
}

function userMenu(): HTMLElement | null {
  const user = session.user;
  if (!user) return null;
  const trigger = h('button', { class: 'rounded-full ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-line-strong', type: 'button', attrs: { 'aria-label': 'Account menu' } }, avatar(user, 28));
  return dropdown(trigger, {
    panel: (close) => {
      const signOut = h('button', { class: 'btn btn-ghost btn-sm w-full justify-start', type: 'button' }, icon('logout', 15), 'Sign out');
      signOut.addEventListener('click', async () => {
        close();
        await api.logout();
        session.user = null;
        navigate('/login', { replace: true });
      });
      return h('div', { class: 'w-56 p-2' }, h('div', { class: 'px-2 pt-1 pb-2' }, h('div', { class: 'truncate text-sm font-semibold' }, user.name), h('div', { class: 'truncate font-mono text-[11px] text-mute' }, `@${user.login}`)), h('div', { class: 'my-1 h-px bg-line' }), signOut);
    },
  });
}

function renderTopbar(chrome: boolean): void {
  topbar.hidden = !chrome;
  if (!chrome) return;
  replace(
    topbar,
    h(
      'div',
      { class: 'mx-auto flex h-14 max-w-[1800px] items-center justify-between px-5 sm:px-8' },
      h('a', { href: '/', class: 'inline-flex items-center gap-2.5 font-display text-lg' }, logoMark(26), 'CloudBoard'),
      h(
        'div',
        { class: 'flex items-center gap-2' },
        h(
          'a',
          {
            href: 'https://github.com/27bhd/CloudBoard',
            target: '_blank',
            rel: 'noreferrer',
            class: 'btn btn-ghost btn-sm hidden sm:inline-flex items-center gap-1.5 text-xs text-mute hover:text-ink',
            title: 'CloudBoard on GitHub',
          },
          githubMark(15),
          'GitHub',
        ),
        themeToggle(),
        userMenu(),
      ),
    ),
  );
}

/** Wraps a page so signed-out visitors bounce to login and return afterwards. */
const authed =
  (page: Page): Page =>
  (el, params) => {
    if (!session.user) {
      const next = location.pathname + location.search;
      queueMicrotask(() => navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true }));
      return;
    }
    return page(el, params);
  };

const notFoundPage: Page = (el) => {
  el.append(
    h(
      'div',
      { class: 'grid min-h-[70dvh] place-items-center px-5 text-center' },
      h('div', {}, h('p', { class: 'eyebrow mb-3' }, '404'), h('h1', { class: 'font-display text-5xl' }, 'Nothing here.'), h('p', { class: 'mt-3 mb-6 text-ink-2' }, 'That page wandered off.'), h('a', { class: 'btn btn-primary', href: '/' }, 'Back to projects')),
    ),
  );
};

setUnauthorizedHandler(() => {
  session.user = null;
  if (location.pathname !== '/login') navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
});

async function boot(): Promise<void> {
  try {
    const me = await api.me();
    session.user = me.user;
    session.devAuth = me.devAuth;
  } catch {
    session.user = null;
  }

  defineRoute(
    '/login',
    (el, params) => {
      if (session.user) {
        const next = new URLSearchParams(location.search).get('next');
        queueMicrotask(() => navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true }));
        return;
      }
      loginPage(el);
      void params;
    },
    false,
  );
  defineRoute('/', authed(projectsPage));
  defineRoute('/p/:id', authed((el, params) => boardPage(el, params, 'board')));
  defineRoute('/p/:id/archive', authed((el, params) => boardPage(el, params, 'archive')));
  defineRoute('/join/:token', joinPage);
  setFallback(notFoundPage);

  startRouter(outlet, (chrome) => renderTopbar(chrome));
}

void boot();
