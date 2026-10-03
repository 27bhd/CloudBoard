/** A deliberately tiny hyperscript helper — the entire "framework" the UI needs. */

type Handlers = { [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void };

export type Child = Node | string | number | null | undefined | false;

type DomProps<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], 'children' | 'style' | 'className' | 'classList' | 'innerHTML' | 'outerHTML'>
>;

export type Props<K extends keyof HTMLElementTagNameMap> = DomProps<K> & {
  class?: string;
  on?: Handlers;
  attrs?: Record<string, string>;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props<K> | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    const { class: className, on, attrs, ...rest } = props;
    if (className) el.className = className;
    Object.assign(el, rest);
    if (attrs) for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    if (on) for (const [type, handler] of Object.entries(on) as [string, EventListener][]) el.addEventListener(type, handler);
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    // Strings always become text nodes, never HTML — user content can't inject markup.
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

export function replace(parent: Element, ...children: Child[]): void {
  parent.replaceChildren();
  append(parent, children);
}

/** Static, trusted SVG markup only (never user content). */
export function svg(markup: string, className = ''): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const el = template.content.firstElementChild as SVGSVGElement;
  if (className) el.setAttribute('class', className);
  return el;
}
