import { create } from 'zustand';
import type { BNode, Device, Doc, PageSettings, Style, StyleTarget, TreeSpec } from './types';
import {
  attachAt,
  detach,
  el,
  emptyDoc,
  instantiate,
  isAncestorOrSelf,
  removeSubtree,
  normalizeTarget,
  rootOf,
  siblingsOf,
  specFromSubtree,
  WRAP,
  wrapSpec,
} from './doc';
import { addProject, loadProject, saveProject } from './projects';
import { isContainer } from './registry';
import { ask } from './ui';
import { colorRef, textStyleFor, tokenIdOf, TYPO_PROPS } from './lib/tokens';
import { slug, uid } from './lib/util';
import type { Tokens } from './types';

export type Drag = { kind: 'new'; spec: TreeSpec; label: string } | { kind: 'move'; id: string };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DropHint {
  parentId: string | null;
  index: number;
  rect?: Rect;
  box?: boolean;
  source: 'canvas' | 'layers';
  layerTarget?: string;
  layerPos?: 'before' | 'after' | 'inside';
}

export type LeftTab = 'elements' | 'sections' | 'layers';
export type InspectorTab = 'content' | 'style' | 'shopify' | 'advanced';
/** Top-level split inside the Inspector when a node is selected. */
export type InspectorMode = 'element' | 'overall';
/** Export variants reuse the modal slot; `null` and `'preview'` are the other values. */
export type ExportKind = 'export-liquid' | 'export-html' | 'export-css';
export type ModalKind = null | 'preview' | ExportKind;
type NodePatch = Partial<Pick<BNode, 'name' | 'className' | 'htmlId' | 'hidden' | 'liquid' | 'entrance' | 'textStyle' | 'stagger'>>;

interface State {
  screen: 'home' | 'editor';
  projectId: string | null;
  doc: Doc;
  past: Doc[];
  future: Doc[];
  _key: string | null;
  _t: number;

  selectedId: string | null;
  /** additional selected nodes (multi-select); the primary is `selectedId` */
  multi: string[];
  hoverId: string | null;
  editingId: string | null;
  reveal: { id: string; t: number } | null;
  device: Device;
  devicePreset: string | null;
  setDevicePreset: (id: string | null) => void;
  styleState: 'normal' | 'hover';
  leftTab: LeftTab;
  inspectorTab: InspectorTab;
  inspectorMode: InspectorMode;
  dragging: Drag | null;
  dropHint: DropHint | null;
  clipboard: TreeSpec | null;
  collapsed: Record<string, boolean>;
  modal: ModalKind;
  /** The export variant last chosen from the top-bar dropdown; drives Ctrl+E and the modal's default tab. */
  lastExportKind: ExportKind;
  toastMsg: string | null;

  commit: (fn: (d: Doc) => void, key?: string) => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null, reveal?: boolean, additive?: boolean) => void;
  /** Primary + multi, top-level only (descendants of another selected node are dropped). */
  selection: () => string[];
  setHover: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setDevice: (d: Device) => void;
  setStyleState: (s: 'normal' | 'hover') => void;
  setLeftTab: (t: LeftTab) => void;
  setInspectorTab: (t: InspectorTab) => void;
  setInspectorMode: (m: InspectorMode) => void;
  toggleCollapsed: (id: string) => void;
  setModal: (m: ModalKind) => void;
  /** Remember the last-used export format (survives reloads, shared across projects). */
  setLastExportKind: (k: ExportKind) => void;
  toast: (msg: string) => void;

  insertSpec: (spec: TreeSpec, parentId: string | null, index: number) => string;
  addSpecSmart: (spec: TreeSpec) => string;
  moveNode: (id: string, parentId: string | null, index: number) => void;
  moveSibling: (id: string, dir: -1 | 1) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  /** Delete with a confirmation for sections / large subtrees / multiple items. */
  requestRemove: (ids?: string[]) => Promise<void>;
  duplicate: (id: string) => void;
  duplicateMany: (ids: string[]) => void;
  groupSelection: () => void;
  copy: (id: string) => void;
  paste: () => void;
  wrapInContainer: (id: string) => void;

  updateProps: (id: string, patch: Record<string, any>) => void;
  setStyle: (id: string, target: StyleTarget, patch: Style) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  setPage: (patch: Partial<PageSettings>) => void;
  setDocName: (name: string) => void;

  updateTokens: (fn: (t: Tokens) => void, key?: string) => void;
  addColorToken: (value: string, name?: string) => string;
  deleteColorToken: (id: string) => void;
  /** Link an element to a text style (its own typography overrides are cleared). */
  applyTextStyle: (nodeId: string, styleId: string | null) => void;
  /** Save an element's typography as a new linked text style. */
  createTextStyleFrom: (nodeId: string, name: string) => void;
  /** Copy the style's values onto the element and unlink it. */
  detachTextStyle: (nodeId: string) => void;
  deleteTextStyle: (id: string) => void;
  /** Open a stored project in the editor. */
  openProject: (id: string) => boolean;
  /** Save a brand-new or imported doc as a project and open it. */
  openNewDoc: (doc: Doc) => boolean;
  goHome: () => void;

  startDrag: (d: Drag) => void;
  setDropHint: (h: DropHint | null) => void;
  endDrag: () => void;
}

const CLIP_KEY = 'sectionforge:clipboard';
const LAST_EXPORT_KEY = 'sectionforge:last-export-kind';

/** Clipboard survives reloads and is shared across projects/tabs. */
function loadClipboard(): TreeSpec | null {
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c.type === 'string' && Array.isArray(c.children) ? c : null;
  } catch {
    return null;
  }
}

/** Last export format the user chose (survives reloads, shared across projects). */
function readLastExportKind(): ExportKind {
  try {
    const v = localStorage.getItem(LAST_EXPORT_KEY);
    return v === 'export-html' || v === 'export-css' || v === 'export-liquid' ? v : 'export-liquid';
  } catch {
    return 'export-liquid';
  }
}

const isExportKind = (m: ModalKind): m is ExportKind =>
  m === 'export-liquid' || m === 'export-html' || m === 'export-css';

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLIP_KEY) useStore.setState({ clipboard: loadClipboard() });
    if (e.key === LAST_EXPORT_KEY) useStore.setState({ lastExportKind: readLastExportKind() });
  });
}

let toastTimer: number | undefined;

export const useStore = create<State>()((set, get) => ({
  screen: 'home',
  projectId: null,
  doc: emptyDoc(),
  past: [],
  future: [],
  _key: null,
  _t: 0,

  selectedId: null,
  multi: [],
  hoverId: null,
  editingId: null,
  reveal: null,
  device: 'desktop',
  devicePreset: null,
  styleState: 'normal',
  leftTab: 'elements',
  inspectorTab: 'style',
  inspectorMode: 'element',
  dragging: null,
  dropHint: null,
  clipboard: loadClipboard(),
  collapsed: {},
  modal: null,
  lastExportKind: readLastExportKind(),
  toastMsg: null,

  commit(fn, key) {
    const { doc, past, _key, _t } = get();
    const next = structuredClone(doc);
    fn(next);
    const now = Date.now();
    const merge = !!key && key === _key && now - _t < 1200;
    set({ doc: next, past: merge ? past : [...past.slice(-150), doc], future: [], _key: key ?? null, _t: now });
  },

  undo() {
    const { past, doc, future, selectedId } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      doc: prev,
      past: past.slice(0, -1),
      future: [doc, ...future].slice(0, 150),
      _key: null,
      editingId: null,
      selectedId: selectedId && prev.nodes[selectedId] ? selectedId : null,
    });
  },

  redo() {
    const { past, doc, future, selectedId } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      doc: next,
      past: [...past, doc],
      future: future.slice(1),
      _key: null,
      editingId: null,
      selectedId: selectedId && next.nodes[selectedId] ? selectedId : null,
    });
  },

  select(id, reveal, additive) {
    if (additive && id) {
      const cur = get().selection();
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      const primary = next[next.length - 1] ?? null;
      set({ selectedId: primary, multi: next.slice(0, -1), editingId: null, styleState: 'normal', inspectorMode: 'element' });
      return;
    }
    if (id === get().selectedId && !reveal && !get().multi.length) return;
    const collapsed = { ...get().collapsed };
    // expand ancestors so the layer is visible
    if (id) {
      let p = get().doc.nodes[id]?.parent;
      while (p) {
        delete collapsed[p];
        p = get().doc.nodes[p]?.parent ?? null;
      }
    }
    set({
      selectedId: id,
      multi: [],
      editingId: null,
      styleState: 'normal',
      // Always reset to Element when a node is clicked so the user sees per-element settings.
      inspectorMode: id ? 'element' : get().inspectorMode,
      collapsed,
      reveal: reveal && id ? { id, t: Date.now() } : get().reveal,
    });
  },
  selection() {
    const { selectedId, multi, doc } = get();
    const all = [...multi, ...(selectedId ? [selectedId] : [])].filter((id) => doc.nodes[id]);
    return all.filter((id) => !all.some((o) => o !== id && isAncestorOrSelf(doc, o, id)));
  },
  setHover: (id) => get().hoverId !== id && set({ hoverId: id }),
  setEditing: (id) => set({ editingId: id, selectedId: id ?? get().selectedId }),
  setDevice: (device) => set({ device, devicePreset: null }),
  setDevicePreset: (devicePreset) => set({ devicePreset }),
  setStyleState: (styleState) => set({ styleState }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setInspectorMode: (inspectorMode) => set({ inspectorMode }),
  toggleCollapsed: (id) => {
    const c = { ...get().collapsed };
    if (c[id]) delete c[id];
    else c[id] = true;
    set({ collapsed: c });
  },
  setModal: (modal) => {
    // Remembering the last export variant keeps Ctrl+E and the dropdown in sync.
    if (isExportKind(modal)) {
      try {
        localStorage.setItem(LAST_EXPORT_KEY, modal);
      } catch {
        /* private mode / quota — non-fatal */
      }
      set({ modal, editingId: null, lastExportKind: modal });
      return;
    }
    set({ modal, editingId: null });
  },
  setLastExportKind(lastExportKind) {
    try {
      localStorage.setItem(LAST_EXPORT_KEY, lastExportKind);
    } catch {
      /* non-fatal */
    }
    set({ lastExportKind });
  },
  toast(msg) {
    clearTimeout(toastTimer);
    set({ toastMsg: msg });
    toastTimer = window.setTimeout(() => set({ toastMsg: null }), 2200);
  },

  insertSpec(spec, parentId, index) {
    let newId = '';
    get().commit((d) => {
      const { parentId: target, index: idx, wrap: wrapped } = normalizeTarget(d, spec.type, parentId, index);
      const out: Record<string, BNode> = {};
      const id = instantiate(wrapped ? wrapSpec(spec) : spec, target, out);
      Object.assign(d.nodes, out);
      attachAt(d, id, target, idx);
      newId = wrapped ? out[out[id].children[0]].children[0] : id;
    });
    get().select(newId, true);
    return newId;
  },

  addSpecSmart(spec) {
    const { selectedId, doc } = get();
    const sel = selectedId ? doc.nodes[selectedId] : null;
    if (spec.type === 'section' || !sel) {
      const r = sel ? rootOf(doc, sel.id) : null;
      return get().insertSpec(spec, null, r ? doc.roots.indexOf(r) + 1 : doc.roots.length);
    }
    if (isContainer(sel.type)) {
      // drop into the section's inner wrapper when a bare section is selected
      if (sel.type === 'section' && sel.children.length === 1 && isContainer(doc.nodes[sel.children[0]].type)) {
        const inner = doc.nodes[sel.children[0]];
        return get().insertSpec(spec, inner.id, inner.children.length);
      }
      return get().insertSpec(spec, sel.id, sel.children.length);
    }
    const sibs = siblingsOf(doc, sel.id);
    return get().insertSpec(spec, sel.parent, sibs.indexOf(sel.id) + 1);
  },

  moveNode(id, parentId, index) {
    const d0 = get().doc;
    const n = d0.nodes[id];
    if (!n) return;
    if (parentId && isAncestorOrSelf(d0, id, parentId)) return;
    const t = normalizeTarget(d0, n.type, parentId, index);
    parentId = t.parentId;
    const oldArr = siblingsOf(d0, id);
    const oldIdx = oldArr.indexOf(id);
    let idx = t.index;
    if (n.parent === parentId && oldIdx < idx) idx--;
    if (n.parent === parentId && oldIdx === idx) return;
    get().commit((d) => {
      detach(d, id);
      if (t.wrap) {
        const out: Record<string, BNode> = {};
        const sid = instantiate(el('section', {}, [el('container', { name: 'Wrapper', style: WRAP })]), null, out);
        Object.assign(d.nodes, out);
        attachAt(d, sid, null, idx);
        attachAt(d, id, out[sid].children[0], 0);
      } else {
        attachAt(d, id, parentId, idx);
      }
    });
    get().select(id);
  },

  moveSibling(id, dir) {
    const d0 = get().doc;
    const n = d0.nodes[id];
    if (!n) return;
    const sibs = siblingsOf(d0, id);
    const i = sibs.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    get().commit((d) => {
      const arr = siblingsOf(d, id);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });
  },

  remove(id) {
    const n = get().doc.nodes[id];
    if (!n) return;
    const sibs = siblingsOf(get().doc, id);
    const i = sibs.indexOf(id);
    const nextSel = sibs[i + 1] ?? sibs[i - 1] ?? n.parent ?? null;
    get().commit((d) => {
      detach(d, id);
      removeSubtree(d, id);
    });
    set({ selectedId: nextSel, multi: [], editingId: null, hoverId: null });
  },

  removeMany(ids) {
    const d0 = get().doc;
    const top = ids.filter((id) => d0.nodes[id] && !ids.some((o) => o !== id && isAncestorOrSelf(d0, o, id)));
    if (!top.length) return;
    if (top.length === 1) return get().remove(top[0]);
    get().commit((d) => {
      for (const id of top) {
        detach(d, id);
        removeSubtree(d, id);
      }
    });
    set({ selectedId: null, multi: [], editingId: null, hoverId: null });
  },

  async requestRemove(ids) {
    const list = ids ?? get().selection();
    const d = get().doc;
    if (!list.length) return;
    const count = (id: string): number => 1 + (d.nodes[id]?.children ?? []).reduce((a, c) => a + count(c), 0);
    const total = list.reduce((a, id) => a + count(id), 0);
    const hasSection = list.some((id) => d.nodes[id]?.type === 'section');
    if (list.length > 1 || hasSection || total >= 6) {
      const what = list.length > 1 ? `${list.length} items` : `“${d.nodes[list[0]].name}”`;
      const ok = await ask({
        title: `Delete ${what}?`,
        message: total > list.length ? `This also removes ${total - list.length} nested element${total - list.length === 1 ? '' : 's'}. You can undo with Ctrl+Z.` : 'You can undo with Ctrl+Z.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
    }
    get().removeMany(list);
  },

  duplicateMany(ids) {
    const d0 = get().doc;
    const top = ids.filter((id) => d0.nodes[id] && !ids.some((o) => o !== id && isAncestorOrSelf(d0, o, id)));
    if (top.length <= 1) return top[0] ? get().duplicate(top[0]) : undefined;
    const created: string[] = [];
    get().commit((d) => {
      for (const id of top) {
        const n = d.nodes[id];
        const out: Record<string, BNode> = {};
        const nid = instantiate(specFromSubtree(d.nodes, id), n.parent, out);
        Object.assign(d.nodes, out);
        const sibs = siblingsOf(d, id);
        attachAt(d, nid, n.parent, sibs.indexOf(id) + 1);
        created.push(nid);
      }
    });
    set({ selectedId: created[created.length - 1], multi: created.slice(0, -1) });
  },

  groupSelection() {
    const d0 = get().doc;
    const ids = get().selection();
    if (!ids.length) return;
    const parent = d0.nodes[ids[0]].parent;
    if (!parent || ids.some((id) => d0.nodes[id].parent !== parent || d0.nodes[id].type === 'section')) {
      get().toast('Select elements that share the same parent to group them.');
      return;
    }
    let gid = '';
    get().commit((d) => {
      const sibs = d.nodes[parent].children;
      const ordered = sibs.filter((c) => ids.includes(c));
      const at = sibs.indexOf(ordered[0]);
      const out: Record<string, BNode> = {};
      gid = instantiate(el('container', { name: 'Group' }), parent, out);
      Object.assign(d.nodes, out);
      d.nodes[parent].children = sibs.filter((c) => !ids.includes(c));
      d.nodes[parent].children.splice(at, 0, gid);
      d.nodes[gid].children = ordered;
      for (const c of ordered) d.nodes[c].parent = gid;
    });
    set({ selectedId: gid, multi: [] });
  },

  duplicate(id) {
    const d0 = get().doc;
    const n = d0.nodes[id];
    if (!n) return;
    const spec = specFromSubtree(d0.nodes, id);
    const sibs = siblingsOf(d0, id);
    get().insertSpec(spec, n.parent, sibs.indexOf(id) + 1);
  },

  copy(id) {
    const d0 = get().doc;
    if (!d0.nodes[id]) return;
    const clip = specFromSubtree(d0.nodes, id);
    set({ clipboard: clip });
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(clip));
    } catch {
      /* too large (e.g. uploaded images) — keep in memory only */
    }
    get().toast(`Copied “${d0.nodes[id].name}”`);
  },

  paste() {
    const clip = get().clipboard;
    if (!clip) return;
    get().addSpecSmart(structuredClone(clip));
  },

  wrapInContainer(id) {
    const d0 = get().doc;
    const n = d0.nodes[id];
    if (!n || n.type === 'section') return;
    let newId = '';
    get().commit((d) => {
      const sibs = siblingsOf(d, id);
      const i = sibs.indexOf(id);
      const out: Record<string, BNode> = {};
      const cid = instantiate(el('container'), n.parent, out);
      Object.assign(d.nodes, out);
      sibs.splice(i, 1, cid);
      d.nodes[id].parent = cid;
      d.nodes[cid].children = [id];
      newId = cid;
    });
    get().select(newId);
  },

  updateProps(id, patch) {
    get().commit((d) => {
      const n = d.nodes[id];
      if (n) Object.assign(n.props, patch);
    }, `props:${id}:${Object.keys(patch).join(',')}`);
  },

  setStyle(id, target, patch) {
    get().commit((d) => {
      const n = d.nodes[id];
      if (!n) return;
      const layer = target === 'desktop' ? n.styles.desktop : (n.styles[target] ??= {});
      for (const k in patch) {
        const v = patch[k];
        if (v === '' || v == null) delete layer[k];
        else layer[k] = v;
      }
      if (target !== 'desktop' && !Object.keys(layer).length) delete n.styles[target];
    }, `style:${id}:${target}:${Object.keys(patch).join(',')}`);
  },

  updateNode(id, patch) {
    get().commit((d) => {
      const n = d.nodes[id];
      if (!n) return;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') delete (n as any)[k];
        else (n as any)[k] = v;
      }
    }, `node:${id}:${Object.keys(patch).join(',')}`);
  },

  setPage(patch) {
    get().commit((d) => Object.assign(d.page, patch), `page:${Object.keys(patch).join(',')}`);
  },

  updateTokens(fn, key) {
    get().commit((d) => fn(d.tokens), key ? `tokens:${key}` : undefined);
  },

  addColorToken(value, name) {
    const taken = new Set(get().doc.tokens.colors.map((c) => c.id));
    const base = slug(name || 'color');
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    get().commit((d) => {
      d.tokens.colors.push({ id, name: name || `Color ${d.tokens.colors.length + 1}`, value });
    });
    return id;
  },

  deleteColorToken(id) {
    get().commit((d) => {
      const tok = d.tokens.colors.find((c) => c.id === id);
      if (!tok) return;
      // freeze every reference to its literal value so nothing changes visually
      for (const n of Object.values(d.nodes))
        for (const layer of [n.styles.desktop, n.styles.tablet, n.styles.mobile, n.styles.hover])
          if (layer) for (const k in layer) if (tokenIdOf(layer[k]) === slug(id)) layer[k] = tok.value;
      d.tokens.colors = d.tokens.colors.filter((c) => c.id !== id);
    });
  },

  applyTextStyle(nodeId, styleId) {
    get().commit((d) => {
      const n = d.nodes[nodeId];
      if (!n) return;
      if (!styleId) {
        delete n.textStyle;
        return;
      }
      n.textStyle = styleId;
      for (const layer of [n.styles.desktop, n.styles.tablet, n.styles.mobile]) if (layer) for (const k of TYPO_PROPS) delete layer[k];
    });
  },

  createTextStyleFrom(nodeId, name) {
    const n0 = get().doc.nodes[nodeId];
    if (!n0) return;
    get().commit((d) => {
      const n = d.nodes[nodeId];
      const pick = (layer?: Style) => {
        const o: Style = {};
        if (layer) for (const k of TYPO_PROPS) if (layer[k] != null) o[k] = layer[k];
        return o;
      };
      const id = uid();
      const tablet = pick(n.styles.tablet);
      const mobile = pick(n.styles.mobile);
      d.tokens.text.push({ id, name, desktop: pick(n.styles.desktop), ...(Object.keys(tablet).length ? { tablet } : {}), ...(Object.keys(mobile).length ? { mobile } : {}) });
      n.textStyle = id;
      for (const layer of [n.styles.desktop, n.styles.tablet, n.styles.mobile]) if (layer) for (const k of TYPO_PROPS) delete layer[k];
    });
    get().toast(`Created text style “${name}”`);
  },

  detachTextStyle(nodeId) {
    get().commit((d) => {
      const n = d.nodes[nodeId];
      const ts = n && d.tokens.text.find((t) => t.id === n.textStyle);
      if (!n || !ts) return;
      n.styles.desktop = { ...ts.desktop, ...n.styles.desktop };
      if (ts.tablet) n.styles.tablet = { ...ts.tablet, ...(n.styles.tablet || {}) };
      if (ts.mobile) n.styles.mobile = { ...ts.mobile, ...(n.styles.mobile || {}) };
      delete n.textStyle;
    });
  },

  deleteTextStyle(id) {
    get().commit((d) => {
      const ts = d.tokens.text.find((t) => t.id === id);
      if (!ts) return;
      for (const n of Object.values(d.nodes)) {
        if (n.textStyle !== id) continue;
        n.styles.desktop = { ...ts.desktop, ...n.styles.desktop };
        if (ts.tablet) n.styles.tablet = { ...ts.tablet, ...(n.styles.tablet || {}) };
        if (ts.mobile) n.styles.mobile = { ...ts.mobile, ...(n.styles.mobile || {}) };
        delete n.textStyle;
      }
      d.tokens.text = d.tokens.text.filter((t) => t.id !== id);
    });
  },

  setDocName(name) {
    get().commit((d) => {
      d.name = name;
    }, 'docname');
  },

  openProject(id) {
    let doc: Doc | null = null;
    try {
      doc = loadProject(id);
    } catch (e) {
      get().toast(e instanceof Error ? e.message : 'Could not open that project.');
      return false;
    }
    if (!doc) return false;
    set({
      screen: 'editor', projectId: doc.id, doc, past: [], future: [], _key: null,
      selectedId: null, multi: [], hoverId: null, editingId: null, collapsed: {}, modal: null,
      device: 'desktop', styleState: 'normal', inspectorMode: 'element',
      lastExportKind: readLastExportKind(),
    });
    return true;
  },

  openNewDoc(doc) {
    const saved = addProject(doc);
    if (!saved) {
      get().toast('Browser storage is full — delete or export an old project first.');
      return false;
    }
    return get().openProject(saved.id);
  },

  goHome() {
    flushSave();
    set({ screen: 'home', projectId: null, selectedId: null, multi: [], hoverId: null, editingId: null, modal: null, past: [], future: [] });
  },

  startDrag: (dragging) => set({ dragging, dropHint: null, hoverId: null }),
  setDropHint: (dropHint) => set({ dropHint }),
  endDrag: () => set({ dragging: null, dropHint: null }),
}));

export { emptyDoc };

// ---- autosave (to the open project) ---------------------------------------------
let saveTimer: number | undefined;
let dirty = false;

function flushSave() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  const { doc, projectId } = useStore.getState();
  if (!projectId || doc.id !== projectId) return;
  if (!saveProject({ ...doc, updatedAt: Date.now() })) {
    useStore.getState().toast('Autosave failed — browser storage is full (large uploaded images?). Download a backup from File.');
  }
}

useStore.subscribe((s, p) => {
  if (s.doc === p.doc || !s.projectId || s.projectId !== p.projectId) return;
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushSave, 400);
});
window.addEventListener('beforeunload', flushSave);
window.addEventListener('pagehide', flushSave);

export const useSelectedNode = () => useStore((s) => (s.selectedId ? s.doc.nodes[s.selectedId] ?? null : null));