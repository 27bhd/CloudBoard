import { h } from '../lib/dom';

interface DropdownOptions {
  /** Builds the panel each time it opens, so content is always fresh. */
  panel: (close: () => void) => HTMLElement;
  align?: 'left' | 'right';
  onOpen?: () => void;
}

/** Anchored popover with outside-click and Esc dismissal. Returns the wrapper to place in the layout. */
export function dropdown(trigger: HTMLElement, { panel, align = 'right', onOpen }: DropdownOptions): HTMLElement {
  const wrapper = h('div', { class: 'relative' }, trigger);
  let open: HTMLElement | null = null;

  const close = () => {
    open?.remove();
    open = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKey, true);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!wrapper.contains(event.target as Node)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      trigger.focus();
    }
  };

  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', () => {
    if (open) return close();
    open = h('div', { class: `popover animate-pop absolute top-full z-30 mt-2 ${align === 'right' ? 'right-0' : 'left-0'}` }, panel(close));
    wrapper.appendChild(open);
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    onOpen?.();
  });
  return wrapper;
}

/**
 * Two-step destructive button — replaces blocking confirm() dialogs.
 * First click arms it for 3 seconds; the second click commits.
 */
export function confirmButton(label: string, armedLabel: string, onConfirm: () => void, className = 'btn btn-sm btn-danger'): HTMLButtonElement {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const button = h('button', { class: className, type: 'button' }, label);
  button.addEventListener('click', () => {
    if (timer === undefined) {
      button.textContent = armedLabel;
      button.classList.add('!border-accent', '!text-accent');
      timer = setTimeout(reset, 3000);
      return;
    }
    reset();
    onConfirm();
  });
  function reset(): void {
    clearTimeout(timer);
    timer = undefined;
    button.textContent = label;
    button.classList.remove('!border-accent', '!text-accent');
  }
  return button;
}
