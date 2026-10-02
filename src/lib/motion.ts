import type { Doc, EntranceAnim, EntranceType } from '../types';
import { staggerIndex } from '../export/structure';

export const ENTRANCES: { v: EntranceType; label: string }[] = [
  { v: 'fade', label: 'Fade in' },
  { v: 'slide-up', label: 'Slide up' },
  { v: 'slide-down', label: 'Slide down' },
  { v: 'slide-left', label: 'Slide in from right' },
  { v: 'slide-right', label: 'Slide in from left' },
  { v: 'zoom-in', label: 'Zoom in' },
  { v: 'zoom-out', label: 'Zoom out' },
  { v: 'blur', label: 'Blur in' },
];

export const EASINGS: [string, string][] = [
  ['cubic-bezier(0.22, 1, 0.36, 1)', 'Smooth'],
  ['ease', 'Ease'],
  ['ease-out', 'Ease out'],
  ['ease-in-out', 'Ease in-out'],
  ['cubic-bezier(0.34, 1.56, 0.64, 1)', 'Bouncy'],
  ['linear', 'Linear'],
];

export const DEFAULT_ENTRANCE: EntranceAnim = {
  type: 'slide-up',
  duration: 700,
  delay: 0,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  distance: 32,
};

function fromFrame(e: EntranceAnim): Keyframe {
  const d = e.distance;
  switch (e.type) {
    case 'slide-up':
      return { opacity: 0, translate: `0 ${d}px` };
    case 'slide-down':
      return { opacity: 0, translate: `0 ${-d}px` };
    case 'slide-left':
      return { opacity: 0, translate: `${d}px 0` };
    case 'slide-right':
      return { opacity: 0, translate: `${-d}px 0` };
    case 'zoom-in':
      return { opacity: 0, scale: '0.92' };
    case 'zoom-out':
      return { opacity: 0, scale: '1.08' };
    case 'blur':
      return { opacity: 0, filter: 'blur(14px)' };
    default:
      return { opacity: 0 };
  }
}

/** Replay entrance animations on the canvas (Web Animations API — never touches the document). */
export function previewEntrances(doc: Doc, rootId: string) {
  const frame = document.querySelector('.ss-frame');
  if (!frame) return;
  const walk = (id: string) => {
    const n = doc.nodes[id];
    if (!n) return;
    const e = n.entrance;
    if (e) {
      const el = frame.querySelector(`[data-ss-id="${id}"]`) as HTMLElement | null;
      const p = n.parent ? doc.nodes[n.parent] : null;
      const i = staggerIndex(doc, n) ?? 0;
      el?.animate([fromFrame(e), { opacity: 1, translate: 'none', scale: 'none', filter: 'none' }], {
        duration: e.duration,
        delay: e.delay + i * (p?.stagger ?? 0),
        easing: e.easing,
        fill: 'backwards',
      });
    }
    n.children.forEach(walk);
  };
  walk(rootId);
}
