import { PRIORITIES, STATUSES, type Priority, type Status } from '../../shared/types';
import { svg } from '../lib/dom';

const stroke = (path: string, size = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A1.5 1.5 0 0 1 6.5 5H15"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
} as const;

export type IconName = keyof typeof PATHS;

export const icon = (name: IconName, size = 16, className = ''): SVGSVGElement => svg(stroke(PATHS[name], size), className);

export const githubMark = (size = 18): SVGSVGElement =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>`,
  );

/** The mark: three columns, the middle one lit - a board, in three strokes. */
export const logoMark = (size = 26): SVGSVGElement =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--ink)"/><rect x="6.5" y="7" width="5" height="13" rx="1.6" fill="var(--bg)"/><rect x="13.5" y="7" width="5" height="18" rx="1.6" fill="var(--accent)"/><rect x="20.5" y="7" width="5" height="8" rx="1.6" fill="var(--bg)"/></svg>`,
  );

const STATUS_COLOR: Record<Status, string> = {
  backlog: 'text-s-backlog',
  todo: 'text-s-todo',
  in_progress: 'text-s-progress',
  review: 'text-s-review',
  done: 'text-s-done',
};

const STATUS_GLYPH: Record<Status, string> = {
  backlog: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.1 2.1"/>',
  todo: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  in_progress:
    '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor"/>',
  review:
    '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8V4a4 4 0 1 1-4 4z" fill="currentColor"/>',
  done: '<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m5 8.2 2 2L11 6" fill="none" stroke="var(--raised)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
};

export const statusIcon = (status: Status, size = 16): SVGSVGElement =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${STATUS_GLYPH[status]}</svg>`, `shrink-0 ${STATUS_COLOR[status]}`);

/** Signal-bar priority glyph; urgent swaps to an accent exclamation badge. */
export function priorityIcon(priority: Priority, size = 14): SVGSVGElement {
  if (priority === 'urgent') {
    return svg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="4" fill="var(--accent)"/><path d="M8 4v5" stroke="var(--accent-ink)" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.8" r="1" fill="var(--accent-ink)"/></svg>`,
      'shrink-0',
    );
  }
  const level = PRIORITIES.indexOf(priority); // none=0 … high=3
  const bar = (x: number, height: number, index: number) =>
    `<rect x="${x}" y="${14 - height}" width="3" height="${height}" rx="1" fill="currentColor" opacity="${level > index ? 1 : 0.22}"/>`;
  return svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${bar(2, 5, 0)}${bar(6.5, 8, 1)}${bar(11, 12, 2)}</svg>`,
    'shrink-0 text-ink-2',
  );
}

export const ALL_STATUSES = STATUSES;
