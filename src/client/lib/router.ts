export type Cleanup = () => void;

/** Page contract: render into `outlet`, optionally return a cleanup for listeners/timers. */
export type Page = (outlet: HTMLElement, params: Record<string, string>) => Cleanup | void;

interface RouteDef {
  pattern: RegExp;
  keys: string[];
  page: Page;
  /** Routes with chrome=false render without the top bar (e.g. login). */
  chrome: boolean;
}

const routes: RouteDef[] = [];
let fallback: Page = () => {};
let current: Cleanup | void;
let outletEl: HTMLElement;
let onRoute: (chrome: boolean, path: string) => void = () => {};

export function defineRoute(path: string, page: Page, chrome = true): void {
  const keys: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  routes.push({ pattern: new RegExp(`^${source}/?$`), keys, page, chrome });
}

export function setFallback(page: Page): void {
  fallback = page;
}

export function navigate(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  resolve();
}

function resolve(): void {
  current?.();
  const path = location.pathname;
  window.scrollTo(0, 0);
  for (const route of routes) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1] ?? '');
    });
    onRoute(route.chrome, path);
    outletEl.replaceChildren();
    current = route.page(outletEl, params);
    return;
  }
  onRoute(true, path);
  outletEl.replaceChildren();
  current = fallback(outletEl, {});
}

export function startRouter(outlet: HTMLElement, hook: (chrome: boolean, path: string) => void): void {
  outletEl = outlet;
  onRoute = hook;
  window.addEventListener('popstate', resolve);
  // Same-origin <a> clicks navigate without a page load.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  resolve();
}
