import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Link2, Plus, X } from 'lucide-react';
import { useStore } from '../store';
import { normalizeValue, resolveStyle, stepValue } from '../lib/style';
import type { Doc, StyleTarget } from '../types';
import { colorRef, findTextStyle, resolveColor, resolveWithTextStyle, textStyleFor, tokenIdOf } from '../lib/tokens';
import { slug } from '../lib/util';

const st = () => useStore.getState();

export function useStyleProp(prop: string) {
  const node = useStore((s) => (s.selectedId ? s.doc.nodes[s.selectedId] : null));
  const device = useStore((s) => s.device);
  const state = useStore((s) => s.styleState);
  const ts = useStore((s) => findTextStyle(s.doc, node?.textStyle));
  const target: StyleTarget = state === 'hover' ? 'hover' : device;
  if (!node) return { own: undefined, inherited: undefined, value: '', set: () => {}, target };
  const layer = target === 'desktop' ? node.styles.desktop : node.styles[target];
  const own = layer?.[prop];
  let inherited: string | undefined;
  if (target === 'hover') inherited = resolveWithTextStyle(node, ts, device, false)[prop];
  else if (device === 'tablet') inherited = node.styles.desktop[prop];
  else if (device === 'mobile') inherited = node.styles.tablet?.[prop] ?? node.styles.desktop[prop];
  // values supplied by a linked text style show as the inherited placeholder
  if (ts && target !== 'hover') {
    const fromStyle = textStyleFor(ts, device)[prop];
    if (fromStyle !== undefined && (device === 'desktop' || inherited === undefined || ts[device]?.[prop] !== undefined)) inherited = fromStyle;
  }
  return {
    own,
    inherited,
    value: own ?? inherited ?? '',
    set: (v: string) => st().setStyle(node.id, target, { [prop]: v }),
    target,
  };
}

/** Coloured dot showing a value is set on the current breakpoint/state; click to reset. */
export function Dot({ prop }: { prop: string }) {
  const sp = useStyleProp(prop);
  if (sp.own === undefined) return null;
  return (
    <button className={`dot dot-${sp.target}`} title="Set here — click to reset" onClick={() => sp.set('')} />
  );
}

function useScrub(prop: string) {
  const sp = useStyleProp(prop);
  const start = useRef<{ x: number; v: string } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const v = sp.own ?? sp.inherited ?? '0';
      if (!/^-?\d*\.?\d+[a-z%]*$/i.test(v.trim())) return;
      start.current = { x: e.clientX, v };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.classList.add('is-scrubbing');
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = Math.round((e.clientX - start.current.x) / 2);
      const step = /em$|rem$/.test(start.current.v) || prop === 'lineHeight' || prop === 'opacity' ? 0.05 : 1;
      const next = stepValue(prop, start.current.v, dx * step * (e.shiftKey ? 10 : 1));
      if (next && next !== sp.own) sp.set(next);
    },
    onPointerUp: () => {
      start.current = null;
      document.body.classList.remove('is-scrubbing');
    },
  };
}

export function LenInput({ prop, placeholder, className = '' }: { prop: string; placeholder?: string; className?: string }) {
  const sp = useStyleProp(prop);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? sp.own ?? '';
  return (
    <input
      className={`inp ${className}`}
      value={shown}
      placeholder={sp.inherited ?? placeholder ?? ''}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value);
        sp.set(normalizeValue(prop, e.target.value));
      }}
      onBlur={(e) => {
        if (draft !== null) sp.set(normalizeValue(prop, e.target.value));
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const base = draft ?? sp.own ?? sp.inherited ?? '0';
          const delta = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
          const next = stepValue(prop, base, delta);
          if (next) {
            e.preventDefault();
            setDraft(null);
            sp.set(next);
          }
        }
      }}
    />
  );
}

export function Row({ label, prop, children, scrub }: { label: string; prop?: string; children: ReactNode; scrub?: boolean }) {
  return (
    <div className="f-row">
      <span className="f-label">
        {prop && scrub ? <ScrubLabel prop={prop} label={label} /> : label}
        {prop && <Dot prop={prop} />}
      </span>
      <div className="f-ctl">{children}</div>
    </div>
  );
}

function ScrubLabel({ prop, label }: { prop: string; label: string }) {
  const h = useScrub(prop);
  return (
    <span className="scrub" {...h} title="Drag to adjust">
      {label}
    </span>
  );
}

/** Compact labelled input used in 2-column grids. */
export function Mini({ label, prop, placeholder }: { label: string; prop: string; placeholder?: string }) {
  const sp = useStyleProp(prop);
  const h = useScrub(prop);
  return (
    <label className={`mini${sp.own !== undefined ? ' is-set t-' + sp.target : ''}`}>
      <span className="mini-l scrub" {...h} title={`${prop} — drag to adjust`}>
        {label}
      </span>
      <LenInput prop={prop} placeholder={placeholder} />
    </label>
  );
}

export function Select({ prop, options }: { prop: string; options: (string | [string, string])[] }) {
  const sp = useStyleProp(prop);
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  return (
    <div className="sel-wrap">
      <select className={`inp sel${sp.own === undefined ? ' inherit' : ''}`} value={sp.own ?? ''} onChange={(e) => sp.set(e.target.value)}>
        <option value="">{sp.inherited ? `${labelFor(opts, sp.inherited)} (inherited)` : '—'}</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
        {sp.own && !opts.some(([v]) => v === sp.own) && <option value={sp.own}>{sp.own}</option>}
      </select>
      <ChevronDown size={12} className="sel-caret" />
    </div>
  );
}

const labelFor = (opts: string[][], v: string) => opts.find((o) => o[0] === v)?.[1] ?? v;

export interface SegOption {
  v: string;
  label?: string;
  icon?: ReactNode;
  title?: string;
}

export function Segmented({ prop, options }: { prop: string; options: SegOption[] }) {
  const sp = useStyleProp(prop);
  const cur = sp.own ?? sp.inherited;
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.v}
          title={o.title ?? o.v}
          className={`${cur === o.v ? (sp.own === o.v ? 'is-on' : 'is-inh') : ''}`}
          onClick={() => sp.set(sp.own === o.v ? '' : o.v)}
        >
          {o.icon ?? o.label ?? o.v}
        </button>
      ))}
    </div>
  );
}

export function toHex(v: string): string {
  const s = (v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
  if (s === 'white') return '#ffffff';
  if (s === 'black') return '#000000';
  return '#000000';
}

export function ColorInput({ prop }: { prop: string }) {
  const sp = useStyleProp(prop);
  const colors = useStore((s) => s.doc.tokens.colors);
  const fakeDoc = { tokens: { colors, text: [] } } as unknown as Doc;
  const val = resolveColor(sp.value, fakeDoc);
  const tokId = tokenIdOf(sp.value);
  const tok = tokId ? colors.find((c) => slug(c.id) === tokId) : undefined;
  return (
    <div className="color-wrap">
      <div className="color">
        <label className="swatch" title="Pick colour">
          <span style={{ background: val || 'transparent' }} className={!val ? 'is-empty' : ''} />
          <input type="color" value={toHex(val)} onChange={(e) => sp.set(e.target.value)} />
        </label>
        {tok ? (
          <div className={`token-chip${sp.own === undefined ? ' inherit' : ''}`} title={`Linked to colour token “${tok.name}” (${tok.value})`}>
            <Link2 size={11} />
            <span>{tok.name}</span>
            {sp.own !== undefined && (
              <button title="Unlink (keep the colour)" onClick={() => sp.set(tok.value)}>
                <X size={11} />
              </button>
            )}
          </div>
        ) : (
          <LenInput prop={prop} placeholder="none" />
        )}
      </div>
      <div className="token-row">
        {colors.map((c) => (
          <button
            key={c.id}
            className={`tok${tokId === slug(c.id) ? ' is-on' : ''}`}
            style={{ background: c.value }}
            title={`${c.name} · ${c.value}`}
            onClick={() => sp.set(colorRef(c.id))}
          />
        ))}
        {val && !tok && /^#|^rgb/i.test(val) && (
          <button
            className="tok tok-add"
            title="Save this colour as a reusable token"
            onClick={() => {
              const id = st().addColorToken(val);
              sp.set(colorRef(id));
            }}
          >
            <Plus size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Stand-alone colour field (not bound to node styles). */
export function PlainColor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="color">
      <label className="swatch">
        <span style={{ background: value }} />
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
      </label>
      <input className="inp" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </div>
  );
}

function BoxInput({ prop }: { prop: string }) {
  const sp = useStyleProp(prop);
  const h = useScrub(prop);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (sp.own ?? '').replace(/px$/, '');
  return (
    <input
      className={`box-in${sp.own !== undefined ? ' is-set t-' + sp.target : ''}`}
      value={shown}
      placeholder={(sp.inherited ?? '0').replace(/px$/, '')}
      spellCheck={false}
      title={prop}
      onChange={(e) => {
        setDraft(e.target.value);
        sp.set(normalizeValue(prop, e.target.value));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = stepValue(prop, sp.own ?? sp.inherited ?? '0', (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
          if (next) {
            setDraft(null);
            sp.set(next);
          }
        }
      }}
      onPointerDown={(e) => {
        if (e.altKey) h.onPointerDown(e);
      }}
    />
  );
}

export function SpacingBox() {
  return (
    <div className="sbox">
      <span className="sbox-l">Margin</span>
      <div className="sbox-t">
        <BoxInput prop="marginTop" />
      </div>
      <div className="sbox-mid">
        <BoxInput prop="marginLeft" />
        <div className="sbox-inner">
          <span className="sbox-l">Padding</span>
          <div className="sbox-t">
            <BoxInput prop="paddingTop" />
          </div>
          <div className="sbox-mid">
            <BoxInput prop="paddingLeft" />
            <div className="sbox-core" />
            <BoxInput prop="paddingRight" />
          </div>
          <div className="sbox-t">
            <BoxInput prop="paddingBottom" />
          </div>
        </div>
        <BoxInput prop="marginRight" />
      </div>
      <div className="sbox-t">
        <BoxInput prop="marginBottom" />
      </div>
    </div>
  );
}

const openGroups: Record<string, boolean> = {};

export function Group({ title, children, defaultOpen = true, extra }: { title: string; children: ReactNode; defaultOpen?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(openGroups[title] ?? defaultOpen);
  return (
    <section className={`grp${open ? ' is-open' : ''}`}>
      <header
        onClick={() => {
          openGroups[title] = !open;
          setOpen(!open);
        }}
      >
        <ChevronDown size={13} className="grp-caret" />
        <span>{title}</span>
        {extra && <span className="grp-extra" onClick={(e) => e.stopPropagation()}>{extra}</span>}
      </header>
      {open && <div className="grp-body">{children}</div>}
    </section>
  );
}

export function Switch({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="switch-row" onClick={() => onChange(!on)}>
      <div>
        <div className="switch-label">{label}</div>
        {desc && <div className="switch-desc">{desc}</div>}
      </div>
      <button className={`switch${on ? ' on' : ''}`} aria-pressed={on}>
        <span />
      </button>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <div className="field-l">{label}</div>
      {children}
      {hint && <div className="field-h">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ shadows */

/**
 * Parse a single-layer `box-shadow` string: "x y blur spread color" (spread/color optional).
 * Returns null when the value isn't a single-layer shadow (e.g. a multi-layer preset), in which
 * case the numeric controls start from reasonable defaults and the first edit replaces it.
 */
function parseShadow(v: string): { x: number; y: number; blur: number; spread: number; color: string } | null {
  const s = (v || '').trim();
  if (!s || s === 'none') return null;
  // reject multiple layers (top-level commas)
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) return null;
  }
  const nums = s.match(/-?\d*\.?\d+px/g) || [];
  const colorMatch = s.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+)\s*$/i);
  if (nums.length < 2) return null;
  return {
    x: parseFloat(nums[0] ?? '0') || 0,
    y: parseFloat(nums[1] ?? '0') || 0,
    blur: nums[2] != null ? parseFloat(nums[2]) : 0,
    spread: nums[3] != null ? parseFloat(nums[3]) : 0,
    color: colorMatch?.[1] ?? 'rgba(15,23,42,0.15)',
  };
}

function buildShadow(x: number, y: number, blur: number, spread: number, color: string): string {
  return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

/**
 * Dev-mode shadow controls: X / Y / Blur / Spread + colour, with a live preview.
 * Operates on the same `boxShadow` string the presets use, so nothing below the UI changes.
 */
export function ShadowControls() {
  const sp = useStyleProp('boxShadow');
  const current = sp.own ?? sp.inherited ?? '';
  const parsed = parseShadow(current);
  // Defaults used the first time the user touches any control on a preset / empty value.
  const [seed, setSeed] = useState({ x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(15,23,42,0.15)' });
  const s = parsed ?? seed;
  const write = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch };
    setSeed(next);
    sp.set(buildShadow(next.x, next.y, next.blur, next.spread, next.color));
  };
  const num = (label: string, key: 'x' | 'y' | 'blur' | 'spread') => (
    <label className="shadow-cell">
      <span>{label}</span>
      <input
        className="inp"
        type="number"
        value={s[key]}
        onChange={(e) => write({ [key]: +e.target.value || 0 } as any)}
      />
    </label>
  );
  return (
    <div className="shadowctl">
      <div className="shadow-preview">
        <span style={{ boxShadow: current || 'none' }} />
      </div>
      <div className="shadow-grid">
        {num('X', 'x')}
        {num('Y', 'y')}
        {num('Blur', 'blur')}
        {num('Spread', 'spread')}
      </div>
      <div className="shadow-color">
        <label className="swatch" title="Shadow colour">
          <span style={{ background: toHex(s.color) }} />
          <input
            type="color"
            value={toHex(s.color)}
            onChange={(e) => {
              // Preserve alpha from the current colour if it had one.
              const a = /rgba?\([^)]*,\s*([\d.]+)\s*\)/.exec(s.color)?.[1];
              const hex = e.target.value;
              const color = a ? hexToRgba(hex, +a) : hex;
              write({ color });
            }}
          />
        </label>
        <input className="inp mono" value={s.color} onChange={(e) => write({ color: e.target.value })} spellCheck={false} />
      </div>
      {!parsed && <p className="hint-line">Currently a preset or multi-layer shadow. Changing any value replaces it with a custom one.</p>}
      {sp.own !== undefined && (
        <button className="btn btn-sm btn-block" onClick={() => sp.set('')}>
          Clear shadow
        </button>
      )}
    </div>
  );
}

function hexToRgba(hex: string, a: number): string {
  const h = toHex(hex).slice(1);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}