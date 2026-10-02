import type React from 'react';
import { useStore, type Drag, type DropHint, type Rect } from './store';
import { isAncestorOrSelf, isRootOnly, rootOf } from './doc';
import { isContainer } from './registry';
import type { BNode, ElementType } from './types';

const frameEl = () => document.querySelector('.ss-frame') as HTMLElement | null;
const elOf = (id: string) => frameEl()?.querySelector(`[data-ss-id="${id}"]`) as HTMLElement | null;
const EDGE = 8;

function draggedType(): ElementType | null {
  const s = useStore.getState();
  const d = s.dragging;
  if (!d) return null;
  return d.kind === 'new' ? d.spec.type : s.doc.nodes[d.id]?.type ?? null;
}
const isSectionDrag = () => {
  const t = draggedType();
  return !!t && isRootOnly(t);
};

/** Small floating label used as the drag image. */
export function setDragGhost(e: React.DragEvent, label: string) {
  const g = document.createElement('div');
  g.className = 'ss-drag-ghost';
  g.textContent = label;
  document.body.appendChild(g);
  e.dataTransfer.setDragImage(g, 14, 14);
  setTimeout(() => g.remove(), 0);
}

const rel = (r: DOMRect, f: DOMRect): Rect => ({ x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height });

/** Children flow left→right (flex row or grid) rather than top→bottom. */
function isRowish(el: Element): boolean {
  const cs = getComputedStyle(el);
  return (cs.display.includes('flex') && cs.flexDirection.startsWith('row')) || cs.display.includes('grid');
}

function insideHint(container: BNode, x: number, y: number, f: DOMRect): DropHint | null {
  const cEl = elOf(container.id);
  if (!cEl) return null;
  // sliders/marquees nest their children in a track element
  const flowEl = (cEl.querySelector(':scope > .ss-slider-track, :scope > .ss-mq-track') as HTMLElement | null) ?? cEl;
  const kids = container.children
    .map((id) => ({ id, el: elOf(id) }))
    .filter((k): k is { id: string; el: HTMLElement } => !!k.el)
    .map((k) => ({ id: k.id, r: k.el.getBoundingClientRect() }))
    .filter((k) => k.r.width > 0 || k.r.height > 0);
  const rowish = isRowish(flowEl);

  let pos = kids.length;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].r;
    if (rowish) {
      if (y < r.top) { pos = i; break; }
      if (y <= r.bottom && x < r.left + r.width / 2) { pos = i; break; }
    } else if (y < r.top + r.height / 2) {
      pos = i;
      break;
    }
  }
  const index = pos < kids.length ? container.children.indexOf(kids[pos].id) : container.children.length;

  let rect: Rect;
  let box = false;
  if (!kids.length) {
    rect = rel(cEl.getBoundingClientRect(), f);
    box = true;
  } else if (pos < kids.length) {
    const r = kids[pos].r;
    rect = rowish ? { x: r.left - f.left - 3, y: r.top - f.top, w: 3, h: r.height } : { x: r.left - f.left, y: r.top - f.top - 2, w: r.width, h: 3 };
  } else {
    const r = kids[kids.length - 1].r;
    rect = rowish ? { x: r.right - f.left + 1, y: r.top - f.top, w: 3, h: r.height } : { x: r.left - f.left, y: r.bottom - f.top - 1, w: r.width, h: 3 };
  }
  return { parentId: container.id, index, rect, box, source: 'canvas' };
}

function rootHint(targetId: string | null, y: number, f: DOMRect): DropHint {
  const { doc } = useStore.getState();
  if (!doc.roots.length) {
    return { parentId: null, index: 0, rect: { x: 16, y: 16, w: f.width - 32, h: 160 }, box: true, source: 'canvas' };
  }
  let index = doc.roots.length;
  let lineY: number;
  if (targetId) {
    const root = rootOf(doc, targetId);
    const r = elOf(root)!.getBoundingClientRect();
    const after = y > r.top + r.height / 2;
    index = doc.roots.indexOf(root) + (after ? 1 : 0);
    lineY = (after ? r.bottom : r.top) - f.top;
  } else {
    const last = elOf(doc.roots[doc.roots.length - 1]);
    lineY = last ? last.getBoundingClientRect().bottom - f.top : 0;
  }
  return { parentId: null, index, rect: { x: 0, y: lineY - 2, w: f.width, h: 4 }, source: 'canvas' };
}

/** Pure hint computation for a pointer at (x, y) over canvas node `targetId` (null = empty frame). */
export function computeCanvasHint(targetId: string | null, x: number, y: number): DropHint | null {
  const s = useStore.getState();
  const frame = frameEl();
  if (!s.dragging || !frame) return null;
  const f = frame.getBoundingClientRect();
  const doc = s.doc;

  if (!targetId || isSectionDrag()) return rootHint(targetId, y, f);
  if (s.dragging.kind === 'move' && isAncestorOrSelf(doc, s.dragging.id, targetId)) return null;

  const node = doc.nodes[targetId];
  if (!node) return null;
  if (isContainer(node.type) && node.parent && node.type !== 'section') {
    // Near the container's own edge (along its parent's flow axis) → drop beside it, not inside.
    const r = elOf(targetId)?.getBoundingClientRect();
    const pEl = elOf(node.parent);
    if (r && pEl) {
      const nearEdge = isRowish(pEl) ? x - r.left < EDGE || r.right - x < EDGE : y - r.top < EDGE || r.bottom - y < EDGE;
      if (nearEdge) return insideHint(doc.nodes[node.parent], x, y, f);
    }
  }
  if (isContainer(node.type)) return insideHint(node, x, y, f);
  if (node.parent) return insideHint(doc.nodes[node.parent], x, y, f);
  return rootHint(targetId, y, f);
}

export function computeLayerHint(targetId: string, rowEl: HTMLElement, y: number): DropHint | null {
  const s = useStore.getState();
  if (!s.dragging) return null;
  const doc = s.doc;
  const node = doc.nodes[targetId];
  if (!node) return null;
  const r = rowEl.getBoundingClientRect();
  const t = (y - r.top) / r.height;

  if (isSectionDrag()) {
    const root = rootOf(doc, targetId);
    const after = root === targetId ? t > 0.5 : true;
    return { parentId: null, index: doc.roots.indexOf(root) + (after ? 1 : 0), source: 'layers', layerTarget: root, layerPos: after ? 'after' : 'before' };
  }
  let pos: 'before' | 'after' | 'inside';
  if (isContainer(node.type)) pos = t < 0.25 && node.parent ? 'before' : t > 0.75 && node.parent ? 'after' : 'inside';
  else pos = t < 0.5 ? 'before' : 'after';
  let hint: DropHint;
  if (pos === 'inside') hint = { parentId: node.id, index: node.children.length, source: 'layers', layerTarget: node.id, layerPos: 'inside' };
  else {
    const sibs = node.parent ? doc.nodes[node.parent].children : doc.roots;
    hint = { parentId: node.parent, index: sibs.indexOf(node.id) + (pos === 'after' ? 1 : 0), source: 'layers', layerTarget: node.id, layerPos: pos };
  }
  if (s.dragging.kind === 'move' && hint.parentId && isAncestorOrSelf(doc, s.dragging.id, hint.parentId)) return null;
  return hint;
}

function commitHint(hint: DropHint | null) {
  const s = useStore.getState();
  const p = s.dropHint;
  const same =
    p && hint &&
    p.parentId === hint.parentId && p.index === hint.index && p.source === hint.source &&
    p.layerPos === hint.layerPos && p.rect?.x === hint.rect?.x && p.rect?.y === hint.rect?.y;
  if (!same && (p || hint)) s.setDropHint(hint);
}

// ---- throttled pointer tracking ------------------------------------------------
type Pending = { kind: 'canvas'; id: string | null; x: number; y: number } | { kind: 'layer'; id: string; el: HTMLElement; y: number };
let pending: Pending | null = null;
let raf = 0;
/** Last known pointer position during a drag (used for auto-scroll). */
export const pointer = { x: 0, y: 0 };

function flush() {
  raf = 0;
  const q = pending;
  pending = null;
  if (!q || !useStore.getState().dragging) return;
  commitHint(q.kind === 'canvas' ? computeCanvasHint(q.id, q.x, q.y) : computeLayerHint(q.id, q.el, q.y));
}
function schedule(p: Pending) {
  pending = p;
  if (!raf) raf = requestAnimationFrame(flush);
}

export function canvasDragOver(e: React.DragEvent, targetId: string | null) {
  const s = useStore.getState();
  if (!s.dragging) return;
  e.preventDefault(); // must be synchronous on every dragover or the drop is refused
  e.stopPropagation();
  e.dataTransfer.dropEffect = s.dragging.kind === 'move' ? 'move' : 'copy';
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  schedule({ kind: 'canvas', id: targetId, x: e.clientX, y: e.clientY });
}

export function layerDragOver(e: React.DragEvent, targetId: string) {
  if (!useStore.getState().dragging) return;
  e.preventDefault();
  e.stopPropagation();
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  schedule({ kind: 'layer', id: targetId, el: e.currentTarget as HTMLElement, y: e.clientY });
}

/** Resolve the hint for an arbitrary screen point (used by touch drag). */
export function hintAtPoint(x: number, y: number) {
  pointer.x = x;
  pointer.y = y;
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const layer = el?.closest('.layer[data-layer-id]') as HTMLElement | null;
  if (layer) return schedule({ kind: 'layer', id: layer.dataset.layerId!, el: layer, y });
  const inFrame = el?.closest('.ss-frame');
  if (inFrame || el?.closest('.canvas')) {
    const id = (el?.closest('[data-ss-id]') as HTMLElement | null)?.getAttribute('data-ss-id') ?? null;
    return schedule({ kind: 'canvas', id: inFrame ? id : null, x, y });
  }
  pending = null;
  commitHint(null);
}

export function performDrop() {
  if (raf) {
    cancelAnimationFrame(raf);
    flush(); // make sure the hint reflects the final pointer position
  }
  const s = useStore.getState();
  const { dragging, dropHint } = s;
  if (dragging && dropHint) {
    if (dragging.kind === 'new') s.insertSpec(dragging.spec, dropHint.parentId, dropHint.index);
    else s.moveNode(dragging.id, dropHint.parentId, dropHint.index);
  }
  s.endDrag();
}

// ---- auto-scroll ------------------------------------------------------------
/** While a drag is active, scroll the canvas / layers list when the pointer nears their edges. */
export function startAutoScroll(): () => void {
  let frame = 0;
  const track = (e: DragEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  window.addEventListener('dragover', track);
  const zone = 72;
  const tick = () => {
    for (const sel of ['.canvas', '.layers']) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (pointer.x < r.left || pointer.x > r.right) continue;
      let dy = 0;
      if (pointer.y < r.top + zone && pointer.y > r.top - 40) dy = -Math.ceil(((r.top + zone - pointer.y) / zone) * 18);
      else if (pointer.y > r.bottom - zone && pointer.y < r.bottom + 40) dy = Math.ceil(((pointer.y - (r.bottom - zone)) / zone) * 18);
      if (dy) {
        el.scrollTop += dy;
        if (pending === null && sel === '.canvas') hintAtPoint(pointer.x, pointer.y); // keep the indicator in sync
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('dragover', track);
  };
}

// ---- touch drag ----------------------------------------------------------------
let touchCleanup: (() => void) | null = null;

/**
 * Pointer-events based drag for touch screens (HTML5 drag-and-drop doesn't fire on touch).
 * Call from pointerdown; `longPress` delays the start so the panel/canvas can still scroll.
 */
export function beginTouchDrag(e: React.PointerEvent, makeDrag: () => Drag, label: string, longPress = 0) {
  if (e.pointerType !== 'touch' || touchCleanup) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;
  let ghost: HTMLDivElement | null = null;
  let timer = 0;

  const start = () => {
    started = true;
    useStore.getState().startDrag(makeDrag());
    ghost = document.createElement('div');
    ghost.className = 'ss-drag-ghost is-touch';
    ghost.textContent = label;
    document.body.appendChild(ghost);
    move(startX, startY);
    navigator.vibrate?.(8);
  };
  const move = (x: number, y: number) => {
    if (ghost) ghost.style.transform = `translate(${x + 12}px, ${y - 36}px)`;
    hintAtPoint(x, y);
  };
  const onMove = (ev: PointerEvent) => {
    if (!started) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 10) {
        if (longPress) return cleanup(); // user is scrolling
        start();
      } else return;
    }
    move(ev.clientX, ev.clientY);
  };
  const blockScroll = (ev: TouchEvent) => started && ev.preventDefault();
  const onUp = () => {
    if (started) performDrop();
    cleanup();
  };
  const cleanup = () => {
    clearTimeout(timer);
    ghost?.remove();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('touchmove', blockScroll);
    if (started && useStore.getState().dragging) useStore.getState().endDrag();
    touchCleanup = null;
  };
  const onCancel = () => cleanup();

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('touchmove', blockScroll, { passive: false });
  if (longPress) timer = window.setTimeout(start, longPress);
  touchCleanup = cleanup;
}
