import { useRef, useState } from 'react';
import {
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
  BoxSelect,
  ClipboardCopy,
  Code2,
  Copy,
  Info,
  Monitor,
  Paintbrush,
  Play,
  ChevronDown,
  PenLine,
  Plus,
  ShoppingBag,
  Smartphone,
  Tablet,
  Trash2,
  Unlink,
  Upload,
  X,
  Settings2,
  Layers,
  Sliders,
} from 'lucide-react';
import { useSelectedNode, useStore, type InspectorTab, type InspectorMode } from '../store';
import { ask, useDev } from '../ui';
import { colorRef } from '../lib/tokens';
import { DEFAULT_ENTRANCE, EASINGS, ENTRANCES, previewEntrances } from '../lib/motion';
import { ELEMENTS, isContainer } from '../registry';
import { FONTS } from '../lib/fonts';
import { ICONS } from '../lib/icons';
import { camel, kebab, normalizeValue, resolveStyle } from '../lib/style';
import { parseVideo } from '../lib/video';
import { classAttr } from '../export/css';
import type { BNode, Device, EntranceAnim, EntranceType, TextStyleToken } from '../types';
import { ColorInput, Field, Group, LenInput, Mini, PlainColor, Row, Segmented, Select, ShadowControls, SpacingBox, Switch, toHex, useStyleProp } from './controls';

const st = () => useStore.getState();

const FONT_OPTIONS: [string, string][] = FONTS.map((f) => [f.stack, f.name]);
const WEIGHTS: [string, string][] = [
  ['300', '300 Light'],
  ['400', '400 Regular'],
  ['500', '500 Medium'],
  ['600', '600 Semibold'],
  ['700', '700 Bold'],
  ['800', '800 Extrabold'],
  ['900', '900 Black'],
];
const JUSTIFY: [string, string][] = [
  ['flex-start', 'Start'],
  ['center', 'Center'],
  ['flex-end', 'End'],
  ['space-between', 'Space between'],
  ['space-around', 'Space around'],
  ['space-evenly', 'Space evenly'],
];
const ALIGN: [string, string][] = [
  ['stretch', 'Stretch'],
  ['flex-start', 'Start'],
  ['center', 'Center'],
  ['flex-end', 'End'],
  ['baseline', 'Baseline'],
];
const SHADOWS = [
  { v: 'none', label: 'None' },
  { v: '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.08)', label: 'S' },
  { v: '0 4px 12px -2px rgba(15,23,42,0.10), 0 2px 4px -2px rgba(15,23,42,0.06)', label: 'M' },
  { v: '0 16px 32px -12px rgba(15,23,42,0.18)', label: 'L' },
  { v: '0 30px 60px -20px rgba(15,23,42,0.30)', label: 'XL' },
];
const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #111827 0%, #312e81 100%)',
  'linear-gradient(180deg, #fdf4ff 0%, #ffffff 100%)',
  'radial-gradient(60% 70% at 50% 0%, rgba(124,108,255,0.35) 0%, rgba(10,10,18,0) 100%)',
];

/** Style keys that have a dedicated control (everything else shows in "Custom properties"). */
const KNOWN = new Set([
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap', 'gridTemplateColumns', 'gridTemplateRows', 'justifyItems',
  'alignSelf', 'flex', 'gridColumn', 'order', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio', 'objectFit',
  'overflow', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'textAlign', 'textTransform', 'textDecoration', 'fontStyle',
  'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'borderWidth', 'borderStyle', 'borderColor',
  'borderRadius', 'boxShadow', 'opacity', 'transform', 'transition', 'cursor', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
]);

const DEVICE_META: Record<Device, { icon: typeof Monitor; label: string }> = {
  desktop: { icon: Monitor, label: 'Desktop' },
  tablet: { icon: Tablet, label: 'Tablet' },
  mobile: { icon: Smartphone, label: 'Mobile' },
};

function StateBar() {
  const device = useStore((s) => s.device);
  const state = useStore((s) => s.styleState);
  const D = DEVICE_META[device];
  return (
    <div className="statebar">
      <div className="seg seg-sm">
        <button className={state === 'normal' ? 'is-on' : ''} onClick={() => st().setStyleState('normal')}>
          Normal
        </button>
        <button className={state === 'hover' ? 'is-on' : ''} onClick={() => st().setStyleState('hover')}>
          Hover
        </button>
      </div>
      <span className={`bp-badge bp-${state === 'hover' ? 'hover' : device}`}>
        {state === 'hover' ? (
          'Hover state'
        ) : (
          <>
            <D.icon size={12} /> {D.label}
            {device !== 'desktop' && <em> overrides</em>}
          </>
        )}
      </span>
    </div>
  );
}

function GridColumns() {
  const sp = useStyleProp('gridTemplateColumns');
  const m = /^repeat\((\d+),/.exec(sp.value);
  const count = m ? +m[1] : sp.value === 'minmax(0, 1fr)' || sp.value === '1fr' ? 1 : null;
  return (
    <div className="seg">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          className={count === n ? (sp.own !== undefined ? 'is-on' : 'is-inh') : ''}
          onClick={() => sp.set(n === 1 ? 'minmax(0, 1fr)' : `repeat(${n}, minmax(0, 1fr))`)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Simple-mode layout control: one choice that sets display + direction together. */
function Arrange({ node }: { node: BNode }) {
  const d = useStyleProp('display');
  const f = useStyleProp('flexDirection');
  const g = useStyleProp('gridTemplateColumns');
  const disp = d.value || 'block';
  const cur = disp.includes('grid') ? 'grid' : disp.includes('flex') ? ((f.value || 'row').startsWith('column') ? 'stack' : 'row') : 'free';
  const apply = (v: string) => {
    const patch: Record<string, string> =
      v === 'stack'
        ? { display: 'flex', flexDirection: 'column' }
        : v === 'row'
          ? { display: 'flex', flexDirection: 'row' }
          : v === 'grid'
            ? { display: 'grid', gridTemplateColumns: g.value || 'repeat(2, minmax(0, 1fr))' }
            : { display: 'block' };
    st().setStyle(node.id, d.target, patch);
  };
  const opts = [
    { v: 'stack', label: 'Stack', title: 'Items on top of each other' },
    { v: 'row', label: 'Row', title: 'Items side by side' },
    { v: 'grid', label: 'Grid', title: 'Items in columns' },
    { v: 'free', label: 'Free', title: 'Normal document flow' },
  ];
  return (
    <div className="seg">
      {opts.map((o) => (
        <button key={o.v} title={o.title} className={cur === o.v ? 'is-on' : ''} onClick={() => apply(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StyleTab({ node }: { node: BNode }) {
  const device = useStore((s) => s.device);
  const state = useStore((s) => s.styleState);
  const parent = useStore((s) => (node.parent ? s.doc.nodes[node.parent] : null));
  const dev = useDev();
  const r = resolveStyle(node, device, state === 'hover');
  const display = r.display || '';
  const isFlex = display.includes('flex');
  const isGrid = display.includes('grid');
  const pDisplay = parent ? resolveStyle(parent, device).display || '' : '';
  const textual = !['image', 'video', 'divider', 'spacer'].includes(node.type);
  const holdsItems = isContainer(node.type);
  const L = (devLabel: string, simple: string) => (dev ? devLabel : simple);

  return (
    <>
      <StateBar />
      {(dev || holdsItems) && (
        <Group title="Layout">
          {dev ? (
            <Row label="Display" prop="display">
              <Select prop="display" options={['block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'none']} />
            </Row>
          ) : (
            <Row label="Arrange">
              <Arrange node={node} />
            </Row>
          )}
          {isFlex && (
            <>
              {dev && (
                <Row label="Direction" prop="flexDirection">
                  <Segmented
                    prop="flexDirection"
                    options={[
                      { v: 'row', icon: <ArrowRight size={13} />, title: 'Row' },
                      { v: 'column', icon: <ArrowDown size={13} />, title: 'Column' },
                      { v: 'row-reverse', label: '←', title: 'Row reverse' },
                      { v: 'column-reverse', label: '↑', title: 'Column reverse' },
                    ]}
                  />
                </Row>
              )}
              <Row label={L('Justify', 'Distribute')} prop="justifyContent">
                <Select prop="justifyContent" options={JUSTIFY} />
              </Row>
              <Row label={L('Align', 'Align items')} prop="alignItems">
                <Select prop="alignItems" options={ALIGN} />
              </Row>
              <Row label="Wrap" prop="flexWrap">
                <Segmented prop="flexWrap" options={[{ v: 'nowrap', label: L('No wrap', 'One line') }, { v: 'wrap', label: 'Wrap' }]} />
              </Row>
            </>
          )}
          {isGrid && (
            <>
              <Row label="Columns" prop="gridTemplateColumns">
                <GridColumns />
              </Row>
              {dev && (
                <>
                  <Row label="Template" prop="gridTemplateColumns">
                    <LenInput prop="gridTemplateColumns" placeholder="repeat(3, 1fr)" />
                  </Row>
                  <Row label="Rows" prop="gridTemplateRows">
                    <LenInput prop="gridTemplateRows" placeholder="auto" />
                  </Row>
                </>
              )}
              <Row label={L('Align', 'Align items')} prop="alignItems">
                <Select prop="alignItems" options={ALIGN} />
              </Row>
              {dev && (
                <Row label="Justify" prop="justifyItems">
                  <Select prop="justifyItems" options={['stretch', 'start', 'center', 'end']} />
                </Row>
              )}
            </>
          )}
          {(isFlex || isGrid) && (
            <Row label={L('Gap', 'Spacing')} prop="gap" scrub>
              <LenInput prop="gap" placeholder="0" />
            </Row>
          )}
        </Group>
      )}

      {(pDisplay.includes('flex') || pDisplay.includes('grid')) && (
        <Group title={dev ? (pDisplay.includes('grid') ? 'Grid item' : 'Flex item') : 'Placement'}>
          <Row label={L('Align self', 'Align')} prop="alignSelf">
            <Select prop="alignSelf" options={[['auto', 'Auto'], ...ALIGN]} />
          </Row>
          {dev &&
            (pDisplay.includes('flex') ? (
              <Row label="Flex" prop="flex">
                <LenInput prop="flex" placeholder="0 1 auto" />
              </Row>
            ) : (
              <Row label="Span" prop="gridColumn">
                <LenInput prop="gridColumn" placeholder="span 2" />
              </Row>
            ))}
          {dev && (
            <Row label="Order" prop="order" scrub>
              <LenInput prop="order" placeholder="0" />
            </Row>
          )}
          {!dev && pDisplay.includes('flex') && <FillToggle />}
        </Group>
      )}

      <Group title="Size">
        <div className="pair">
          <Mini label={L('W', 'Width')} prop="width" placeholder="auto" />
          <Mini label={L('H', 'Height')} prop="height" placeholder="auto" />
          {dev && <Mini label="Min W" prop="minWidth" />}
          <Mini label={L('Min H', 'Min height')} prop="minHeight" />
          <Mini label={L('Max W', 'Max width')} prop="maxWidth" placeholder="none" />
          {dev && <Mini label="Max H" prop="maxHeight" placeholder="none" />}
        </div>
        <Row label={L('Ratio', 'Shape')} prop="aspectRatio">
          <Select
            prop="aspectRatio"
            options={[
              ['1 / 1', '1:1 Square'],
              ['4 / 5', '4:5 Portrait'],
              ['3 / 4', '3:4'],
              ['4 / 3', '4:3'],
              ['3 / 2', '3:2'],
              ['16 / 9', '16:9 Wide'],
              ['21 / 9', '21:9 Cinema'],
            ]}
          />
        </Row>
        {(node.type === 'image' || node.type === 'video') && (
          <Row label={L('Fit', 'Crop')} prop="objectFit">
            <Segmented
              prop="objectFit"
              options={[
                { v: 'cover', label: L('Cover', 'Fill') },
                { v: 'contain', label: L('Contain', 'Fit') },
                { v: 'fill', label: L('Fill', 'Stretch') },
              ]}
            />
          </Row>
        )}
        {dev && (
          <Row label="Overflow" prop="overflow">
            <Segmented prop="overflow" options={[{ v: 'visible', label: 'Visible' }, { v: 'hidden', label: 'Hidden' }, { v: 'auto', label: 'Auto' }]} />
          </Row>
        )}
      </Group>

      <Group title="Spacing">
        <SpacingBox />
        {!dev && <p className="hint-line">Inner box = padding (space inside) · outer box = margin (space around)</p>}
      </Group>

      {textual && (
        <Group title={L('Typography', 'Text')}>
          <TextStylePicker node={node} />
          <Row label="Font" prop="fontFamily">
            <Select prop="fontFamily" options={FONT_OPTIONS} />
          </Row>
          <div className="pair">
            <Mini label="Size" prop="fontSize" placeholder="16px" />
            <Mini label={L('Line', 'Line height')} prop="lineHeight" placeholder="normal" />
          </div>
          <Row label="Weight" prop="fontWeight">
            <Select prop="fontWeight" options={WEIGHTS} />
          </Row>
          <Row label={L('Tracking', 'Letter spacing')} prop="letterSpacing" scrub>
            <LenInput prop="letterSpacing" placeholder="normal" />
          </Row>
          <Row label="Color" prop="color">
            <ColorInput prop="color" />
          </Row>
          <Row label="Align" prop="textAlign">
            <Segmented
              prop="textAlign"
              options={[
                { v: 'left', icon: <AlignLeft size={13} /> },
                { v: 'center', icon: <AlignCenter size={13} /> },
                { v: 'right', icon: <AlignRight size={13} /> },
                { v: 'justify', icon: <AlignJustify size={13} /> },
              ]}
            />
          </Row>
          <Row label={L('Case', 'Capitals')} prop="textTransform">
            <Segmented
              prop="textTransform"
              options={[
                { v: 'none', label: '—', title: 'None' },
                { v: 'uppercase', label: 'AA', title: 'Uppercase' },
                { v: 'capitalize', label: 'Aa', title: 'Capitalize' },
                { v: 'lowercase', label: 'aa', title: 'Lowercase' },
              ]}
            />
          </Row>
          <Row label={L('Decoration', 'Underline')} prop="textDecoration">
            <Segmented
              prop="textDecoration"
              options={[
                { v: 'none', label: '—', title: 'None' },
                { v: 'underline', label: 'U', title: 'Underline' },
                { v: 'line-through', label: 'S', title: 'Strikethrough' },
              ]}
            />
          </Row>
          <Row label="Style" prop="fontStyle">
            <Segmented prop="fontStyle" options={[{ v: 'normal', label: 'Normal' }, { v: 'italic', label: 'Italic' }]} />
          </Row>
        </Group>
      )}

      <Group title="Background">
        <Row label="Color" prop="backgroundColor">
          <ColorInput prop="backgroundColor" />
        </Row>
        <Row label={L('Image', 'Gradient')} prop="backgroundImage">
          <LenInput prop="backgroundImage" placeholder={dev ? 'url(…) or gradient' : 'pick one below'} />
        </Row>
        <BgPresets />
        {dev && (
          <div className="pair">
            <Mini label="Size" prop="backgroundSize" placeholder="auto" />
            <Mini label="Pos" prop="backgroundPosition" placeholder="0 0" />
          </div>
        )}
      </Group>

      <Group title="Border" defaultOpen={false}>
        <div className="pair">
          <Mini label={L('Width', 'Thickness')} prop="borderWidth" placeholder="0" />
          <Mini label={L('Radius', 'Corners')} prop="borderRadius" placeholder="0" />
        </div>
        <Row label="Style" prop="borderStyle">
          <Segmented prop="borderStyle" options={[{ v: 'none', label: 'None' }, { v: 'solid', label: 'Solid' }, { v: 'dashed', label: 'Dash' }, { v: 'dotted', label: 'Dot' }]} />
        </Row>
        <Row label="Color" prop="borderColor">
          <ColorInput prop="borderColor" />
        </Row>
      </Group>

      <AnimationGroup node={node} />

      <Group title="Effects" defaultOpen={false}>
        <Row label="Shadow" prop="boxShadow">
          <Segmented prop="boxShadow" options={SHADOWS} />
        </Row>
        {dev && (
          <>
            <div className="field-l">Custom shadow</div>
            <ShadowControls />
          </>
        )}
        <Row label="Opacity" prop="opacity" scrub>
          <LenInput prop="opacity" placeholder="1" />
        </Row>
        {dev && (
          <>
            <Row label="Transform" prop="transform">
              <LenInput prop="transform" placeholder="none" />
            </Row>
            <Row label="Transition" prop="transition">
              <LenInput prop="transition" placeholder="all 0.2s ease" />
            </Row>
            <Row label="Cursor" prop="cursor">
              <Select prop="cursor" options={['auto', 'default', 'pointer', 'text', 'move', 'not-allowed']} />
            </Row>
          </>
        )}
      </Group>

      {dev && (
        <Group title="Position" defaultOpen={false}>
          <Row label="Type" prop="position">
            <Select prop="position" options={['static', 'relative', 'absolute', 'fixed', 'sticky']} />
          </Row>
          <div className="pair">
            <Mini label="T" prop="top" placeholder="auto" />
            <Mini label="R" prop="right" placeholder="auto" />
            <Mini label="B" prop="bottom" placeholder="auto" />
            <Mini label="L" prop="left" placeholder="auto" />
          </div>
          <Row label="Z-index" prop="zIndex" scrub>
            <LenInput prop="zIndex" placeholder="auto" />
          </Row>
        </Group>
      )}
    </>
  );
}

/** Simple-mode stand-in for `flex`: "take up the remaining space". */
function FillToggle() {
  const sp = useStyleProp('flex');
  const on = /^1\b/.test(sp.value);
  return (
    <Row label="Fill space">
      <div className="seg">
        <button className={!on ? 'is-on' : ''} onClick={() => sp.set('')}>
          Fit content
        </button>
        <button className={on ? 'is-on' : ''} onClick={() => sp.set('1 1 0')}>
          Fill
        </button>
      </div>
    </Row>
  );
}

function TextStylePicker({ node }: { node: BNode }) {
  const styles = useStore((s) => s.doc.tokens.text);
  const cur = node.textStyle && styles.some((t) => t.id === node.textStyle) ? node.textStyle : '';
  return (
    <Row label="Text style">
      <div className="anim-row">
        <div className="sel-wrap">
          <select className={`inp sel${cur ? '' : ' inherit'}`} value={cur} onChange={(e) => st().applyTextStyle(node.id, e.target.value || null)}>
            <option value="">None</option>
            {styles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="sel-caret" />
        </div>
        {cur ? (
          <button className="icon-btn" title="Detach — copy the style’s values onto this element and unlink" onClick={() => st().detachTextStyle(node.id)}>
            <Unlink size={13} />
          </button>
        ) : (
          <button className="icon-btn" title="Save this element’s typography as a reusable text style" onClick={() => st().createTextStyleFrom(node.id, node.name)}>
            <Plus size={13} />
          </button>
        )}
      </div>
    </Row>
  );
}
function RangeRow({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="range-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <output>
        {value}
        {unit}
      </output>
    </label>
  );
}

function AnimationGroup({ node }: { node: BNode }) {
  const doc = useStore((s) => s.doc);
  const e = node.entrance;
  const set = (patch: Partial<EntranceAnim> | null) =>
    st().updateNode(node.id, { entrance: patch === null ? undefined : ({ ...DEFAULT_ENTRANCE, ...e, ...patch } as EntranceAnim) });
  const replay = () => requestAnimationFrame(() => previewEntrances(useStore.getState().doc, node.id));
  const kids = node.children.length;
  return (
    <Group title="Animation" defaultOpen={!!e} extra={e ? <span className="grp-badge">On</span> : undefined}>
      <Row label="On scroll">
        <div className="anim-row">
          <div className="sel-wrap">
            <select
              className={`inp sel${e ? '' : ' inherit'}`}
              value={e?.type ?? ''}
              onChange={(ev) => {
                set(ev.target.value ? { type: ev.target.value as EntranceType } : null);
                if (ev.target.value) replay();
              }}
            >
              <option value="">None</option>
              {ENTRANCES.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="sel-caret" />
          </div>
          {e && (
            <button className="icon-btn" title="Preview on canvas" onClick={replay}>
              <Play size={13} />
            </button>
          )}
        </div>
      </Row>
      {e && (
        <>
          <RangeRow label="Duration" value={e.duration} min={150} max={2500} step={50} unit="ms" onChange={(v) => set({ duration: v })} />
          <RangeRow label="Delay" value={e.delay} min={0} max={2000} step={50} unit="ms" onChange={(v) => set({ delay: v })} />
          {e.type.startsWith('slide') && <RangeRow label="Distance" value={e.distance} min={8} max={160} step={4} unit="px" onChange={(v) => set({ distance: v })} />}
          <Row label="Easing">
            <div className="sel-wrap">
              <select className="inp sel" value={e.easing} onChange={(ev) => set({ easing: ev.target.value })}>
                {EASINGS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                {!EASINGS.some(([v]) => v === e.easing) && <option value={e.easing}>{e.easing}</option>}
              </select>
              <ChevronDown size={12} className="sel-caret" />
            </div>
          </Row>
        </>
      )}
      {isContainer(node.type) && kids > 0 && (
        <>
          <RangeRow label="Stagger" value={node.stagger ?? 0} min={0} max={600} step={20} unit="ms" onChange={(v) => st().updateNode(node.id, { stagger: v || undefined })} />
          <button
            className="btn btn-sm btn-block"
            onClick={() => {
              const base = e ?? DEFAULT_ENTRANCE;
              st().commit((d) => {
                const n = d.nodes[node.id];
                for (const c of n.children) d.nodes[c].entrance = { ...base };
                if (!n.stagger) n.stagger = 120;
              });
              replay();
            }}
          >
            Animate all {kids} children
          </button>
          <p className="hint-line">Stagger delays each animated child after the previous one. Great for grids and lists.</p>
        </>
      )}
      {doc.nodes[node.id] && !e && !isContainer(node.type) && <p className="hint-line">Elements animate in as they scroll into view. Respects reduced-motion settings.</p>}
    </Group>
  );
}

function BgPresets() {
  const sp = useStyleProp('backgroundImage');
  return (
    <div className="grad-row">
      {GRADIENTS.map((g) => (
        <button key={g} className={`grad${sp.value === g ? ' is-on' : ''}`} style={{ background: g }} onClick={() => sp.set(sp.own === g ? '' : g)} title={g} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContentTab({ node }: { node: BNode }) {
  const up = (patch: Record<string, any>) => st().updateProps(node.id, patch);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = node.props;

  switch (node.type) {
    case 'section':
    case 'container':
      return (
        <div className="pad">
          <Field label="HTML tag">
            <select className="inp" value={p.tag || (node.type === 'section' ? 'section' : 'div')} onChange={(e) => up({ tag: e.target.value })}>
              {['section', 'div', 'header', 'footer', 'article', 'aside', 'nav', 'main'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <p className="muted">Containers hold other elements. Use the Style tab to control layout, spacing and background.</p>
        </div>
      );
    case 'grid':
      return (
        <div className="pad">
          <p className="muted">Grid columns, gap and alignment live in the Style tab. Each child becomes a grid cell.</p>
        </div>
      );
    case 'heading':
      return (
        <div className="pad">
          <Field label="Text">
            <textarea className="inp ta" rows={3} value={p.text} onChange={(e) => up({ text: e.target.value })} />
          </Field>
          <Field label="Level">
            <div className="seg">
              {[1, 2, 3, 4, 5, 6].map((l) => (
                <button key={l} className={(p.level || 2) === l ? 'is-on' : ''} onClick={() => up({ level: l })}>
                  H{l}
                </button>
              ))}
            </div>
          </Field>
          <Tip>Double-click the text on the canvas to edit it inline.</Tip>
        </div>
      );
    case 'text':
      return (
        <div className="pad">
          <Field label="Text">
            <textarea className="inp ta" rows={6} value={p.text} onChange={(e) => up({ text: e.target.value })} />
          </Field>
          <Field label="HTML tag">
            <div className="seg">
              {['p', 'div', 'span', 'blockquote'].map((t) => (
                <button key={t} className={(p.tag || 'p') === t ? 'is-on' : ''} onClick={() => up({ tag: t })}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Tip>Double-click the text on the canvas to edit inline. Shift+Enter adds a line break.</Tip>
        </div>
      );
    case 'button':
    case 'link':
      return (
        <div className="pad">
          <Field label="Label">
            <input className="inp" value={p.text} onChange={(e) => up({ text: e.target.value })} />
          </Field>
          <Field label="Link URL" hint="Use Shopify paths like /collections/all or /pages/about">
            <input className="inp" value={p.href} placeholder="https://" onChange={(e) => up({ href: e.target.value })} />
          </Field>
          <Switch on={!!p.newTab} onChange={(v) => up({ newTab: v })} label="Open in new tab" />
        </div>
      );
    case 'list':
      return (
        <div className="pad">
          <Field label="Items" hint="One item per line">
            <textarea
              className="inp ta"
              rows={6}
              value={(p.items || []).join('\n')}
              onChange={(e) => up({ items: e.target.value.split('\n') })}
            />
          </Field>
          <Switch on={!!p.ordered} onChange={(v) => up({ ordered: v })} label="Numbered list" />
        </div>
      );
    case 'icon':
      return (
        <div className="pad">
          <Field label="Icon">
            <div className="icon-grid">
              {Object.entries(ICONS).map(([name, I]) => (
                <button key={name} title={name} className={p.icon === name ? 'is-on' : ''} onClick={() => up({ icon: name })}>
                  <I size={16} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Size · ${p.size}px`}>
            <input type="range" min={12} max={96} value={p.size} onChange={(e) => up({ size: +e.target.value })} />
          </Field>
          <Field label={`Stroke · ${p.stroke}`}>
            <input type="range" min={0.75} max={3} step={0.25} value={p.stroke} onChange={(e) => up({ stroke: +e.target.value })} />
          </Field>
        </div>
      );
    case 'image':
      return (
        <div className="pad">
          <div className="img-prev">{p.src ? <img src={p.src} alt="" /> : <span>No image</span>}</div>
          {p.src?.startsWith('data:') && (
            <div className="warn-box">
              <AlertTriangle size={14} />
              <div>
                <b>Uploaded image · {Math.round((p.src.length * 0.75) / 1024)} KB</b>
                <span>
                  Embedded as base64 in HTML exports. The Shopify export can’t include it — the section shows a placeholder until a
                  merchant picks an image. For best results upload it to Shopify (Content → Files) or any host and paste the URL.
                </span>
              </div>
            </div>
          )}
          <Field label="Image URL">
            <input className="inp" value={p.src?.startsWith('data:') ? '(uploaded image)' : p.src} placeholder="https://…" onChange={(e) => up({ src: e.target.value })} />
          </Field>
          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1.5 * 1024 * 1024) st().toast('Tip: large uploads are stored in your browser — prefer image URLs for big files.');
              const reader = new FileReader();
              reader.onload = () => up({ src: String(reader.result) });
              reader.readAsDataURL(f);
              e.target.value = '';
            }}
          />
          <Field label="Alt text" hint="Describe the image for screen readers & SEO">
            <input className="inp" value={p.alt} onChange={(e) => up({ alt: e.target.value })} />
          </Field>
        </div>
      );
    case 'video': {
      const v = parseVideo(p.url);
      return (
        <div className="pad">
          <Field label="Video URL" hint="YouTube, Vimeo or a direct .mp4 link">
            <input className="inp" value={p.url} onChange={(e) => up({ url: e.target.value })} />
          </Field>
          <p className="muted">Detected: <b>{v.kind === 'none' ? 'nothing yet' : v.kind}</b></p>
        </div>
      );
    }
    case 'marquee':
      return (
        <div className="pad">
          <RangeRow label="Loop time" value={+p.speed || 30} min={5} max={120} step={1} unit="s" onChange={(v) => up({ speed: v })} />
          <Field label="Direction">
            <div className="seg">
              {(['left', 'right'] as const).map((d) => (
                <button key={d} className={(p.direction || 'left') === d ? 'is-on' : ''} onClick={() => up({ direction: d })}>
                  {d === 'left' ? '← Scroll left' : 'Scroll right →'}
                </button>
              ))}
            </div>
          </Field>
          <RangeRow label="Repeats" value={+p.copies || 2} min={1} max={6} step={1} unit="×" onChange={(v) => up({ copies: v })} />
          <Switch on={!!p.pauseOnHover} onChange={(v) => up({ pauseOnHover: v })} label="Pause on hover" />
          <Tip>Children scroll in an endless loop. Increase “Repeats” if there’s a gap on wide screens. Use Play motion (above the canvas) to preview.</Tip>
        </div>
      );
    case 'slider': {
      const pv = p.perView || {};
      const setPer = (k: Device, v: string) => up({ perView: { ...pv, [k]: Math.max(1, Math.min(8, +v || 1)) } });
      return (
        <div className="pad">
          <Field label="Slides visible" hint="Per device · each child is one slide">
            <div className="per-view">
              {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => {
                const D = DEVICE_META[d];
                return (
                  <label key={d} title={D.label}>
                    <D.icon size={13} />
                    <input type="number" min={1} max={8} step={0.5} value={pv[d] ?? ''} placeholder="1" onChange={(e) => setPer(d, e.target.value)} />
                  </label>
                );
              })}
            </div>
          </Field>
          <RangeRow label="Autoplay" value={+p.autoplay || 0} min={0} max={15} step={1} unit={+p.autoplay ? 's' : ' off'} onChange={(v) => up({ autoplay: v })} />
          <Switch on={!!p.arrows} onChange={(v) => up({ arrows: v })} label="Arrows" />
          <Switch on={!!p.dots} onChange={(v) => up({ dots: v })} label="Dots" />
          <Switch on={!!p.loop} onChange={(v) => up({ loop: v })} label="Loop back to start" />
          <Tip>Without JavaScript the slideshow still works as a swipeable row. Autoplay pauses on hover and respects reduced motion.</Tip>
        </div>
      );
    }
    case 'embed':
      return (
        <div className="pad">
          <Field label="HTML" hint="Scripts don’t run inside the editor canvas, but are kept in the export.">
            <textarea className="inp ta mono" rows={14} spellCheck={false} value={p.html} onChange={(e) => up({ html: e.target.value })} />
          </Field>
        </div>
      );
    default:
      return (
        <div className="pad">
          <p className="muted">This element has no content settings — use the Style tab.</p>
        </div>
      );
  }
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="tip">
      <Info size={12} /> {children}
    </p>
  );
}

// ---------------------------------------------------------------------------

function ShopifyTab({ node }: { node: BNode }) {
  const doc = useStore((s) => s.doc);
  const L = node.liquid || {};
  const set = (patch: Record<string, any>) => st().updateNode(node.id, { liquid: { ...L, ...patch } });
  const setDesign = (patch: Partial<NonNullable<typeof L.design>>) =>
    st().updateNode(node.id, { liquid: { ...L, design: { ...(L.design || {}), ...patch } } });
  const isRoot = !node.parent;

  let blockAncestor: BNode | null = null;
  for (let p = node.parent; p; p = doc.nodes[p]?.parent ?? null) if (doc.nodes[p]?.liquid?.blocks) blockAncestor = doc.nodes[p];

  const fieldType: Record<string, string> = {
    heading: 'inline_richtext',
    text: (node.props.text || '').includes('\n') ? 'richtext' : 'inline_richtext',
    button: 'text + url',
    link: 'text + url',
    image: 'image_picker',
    list: 'textarea',
    video: 'video_url',
    ...(blockAncestor ? { icon: 'select (icon picker)' } : {}),
  };

  const design = L.design || {};

  return (
    <div className="pad">
      {isRoot && (
        <>
          <div className="shop-card">
            <ShoppingBag size={16} />
            <div>
              <b>This section exports as a Shopify section file</b>
              <span>Content becomes editable settings in the theme editor, with a ready-to-use preset.</span>
            </div>
          </div>
          <Field label="Section name (theme editor)" hint="Max 25 characters">
            <input className="inp" maxLength={25} value={L.sectionName ?? node.name.slice(0, 25)} onChange={(e) => set({ sectionName: e.target.value })} />
          </Field>

          <div className="field-l" style={{ marginTop: 18 }}>Design settings (theme editor)</div>
          <p className="muted" style={{ marginTop: 0 }}>
            Expose colours and spacing as theme-editor settings with separate desktop and mobile values.
          </p>
          <Switch on={!!design.background} onChange={(v) => setDesign({ background: v })} label="Background colour" desc="Desktop + mobile colour pickers" />
          <Switch on={!!design.text} onChange={(v) => setDesign({ text: v })} label="Text colour" desc="Desktop + mobile colour pickers" />
          <Switch on={!!design.padding} onChange={(v) => setDesign({ padding: v })} label="Padding (top / bottom)" desc="Desktop + mobile sliders" />
          <Switch on={!!design.margin} onChange={(v) => setDesign({ margin: v })} label="Section spacing (margin)" desc="Desktop + mobile sliders" />

          <button className="btn btn-block btn-accent" style={{ marginTop: 16 }} onClick={() => st().setModal('export-liquid')}>
            <Code2 size={14} /> Export Liquid
          </button>
        </>
      )}

      {!isRoot && isContainer(node.type) && (
        <>
          <Switch
            on={!!L.blocks}
            onChange={(v) => set({ blocks: v })}
            label="Repeatable blocks"
            desc="Each child becomes a Shopify block merchants can add, remove and reorder."
          />
          {L.blocks && (
            <>
              <Field label="Block name" hint={`The first child is the block template · ${node.children.length} preset block${node.children.length === 1 ? '' : 's'}`}>
                <input
                  className="inp"
                  maxLength={25}
                  value={L.blockName ?? doc.nodes[node.children[0]]?.name ?? ''}
                  onChange={(e) => set({ blockName: e.target.value })}
                />
              </Field>
              {blockAncestor && <p className="warn">Nested inside another block container — this one will export as static layout.</p>}
            </>
          )}
          {!L.blocks && <p className="muted">Layout container — exported as plain markup.</p>}
        </>
      )}

      {fieldType[node.type] && (
        <>
          <Switch
            on={L.expose !== false}
            onChange={(v) => set({ expose: v })}
            label="Editable in theme editor"
            desc={`Exports as a “${fieldType[node.type]}” setting`}
          />
          {L.expose !== false && (
            <Field label="Setting label">
              <input className="inp" value={L.label ?? ''} placeholder={node.name} onChange={(e) => set({ label: e.target.value || undefined })} />
            </Field>
          )}
          {blockAncestor && (
            <p className="muted">
              Part of the <b>{blockAncestor.liquid?.blockName || blockAncestor.name}</b> block — this becomes a block setting.
            </p>
          )}
        </>
      )}

      {!isRoot && !isContainer(node.type) && !fieldType[node.type] && <p className="muted">Static element — exported as plain HTML.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CustomProps({ node }: { node: BNode }) {
  const device = useStore((s) => s.device);
  const state = useStore((s) => s.styleState);
  const target = state === 'hover' ? 'hover' : device;
  const layer = (target === 'desktop' ? node.styles.desktop : node.styles[target]) || {};
  const extra = Object.entries(layer).filter(([k]) => !KNOWN.has(k));
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const add = () => {
    if (!k.trim() || !v.trim()) return;
    st().setStyle(node.id, target, { [camel(k)]: v.trim() });
    setK('');
    setV('');
  };
  return (
    <div className="cprops">
      {extra.map(([key, val]) => (
        <div key={key} className="cprop">
          <code>{kebab(key)}</code>
          <input className="inp" value={val} onChange={(e) => st().setStyle(node.id, target, { [key]: e.target.value })} />
          <button className="icon-btn" onClick={() => st().setStyle(node.id, target, { [key]: '' })} title="Remove">
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="cprop add">
        <input className="inp mono" placeholder="property" value={k} onChange={(e) => setK(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="inp" placeholder="value" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="icon-btn" onClick={add} title="Add">
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function AdvancedTab({ node }: { node: BNode }) {
  const devices: Device[] = ['desktop', 'tablet', 'mobile'];
  const dev = useDev();
  return (
    <div className="pad">
      <Field label="Layer name">
        <input className="inp" value={node.name} onChange={(e) => st().updateNode(node.id, { name: e.target.value })} />
      </Field>
      {dev && (
      <>
      <Field label="CSS class" hint={node.className ? 'Custom class — must be unique for per-element styles' : 'Auto-generated from the layer name'}>
        <input
          className="inp mono"
          value={node.className ?? ''}
          placeholder={classAttr({ ...node, className: undefined })}
          onChange={(e) => st().updateNode(node.id, { className: e.target.value.replace(/[^\w\s-]/g, '') })}
        />
      </Field>
      <Field label="HTML id" hint="Useful for anchor links (#id)">
        <input className="inp mono" value={node.htmlId ?? ''} onChange={(e) => st().updateNode(node.id, { htmlId: e.target.value.replace(/[^\w-]/g, '') })} />
      </Field>
      </>
      )}
      <Field label={dev ? 'Visibility' : 'Show on'}>
        <div className="seg">
          {devices.map((d) => {
            const D = DEVICE_META[d];
            const hidden = !!node.hidden?.[d];
            return (
              <button
                key={d}
                className={hidden ? 'is-off' : 'is-on'}
                title={hidden ? `Hidden on ${d}` : `Visible on ${d}`}
                onClick={() => st().updateNode(node.id, { hidden: { ...node.hidden, [d]: !hidden } })}
              >
                <D.icon size={13} /> {hidden ? 'Hidden' : 'Shown'}
              </button>
            );
          })}
        </div>
      </Field>
      {dev && (
        <Field label="Custom CSS properties" hint="Applied to the current breakpoint / state">
          <CustomProps node={node} />
        </Field>
      )}
      <div className="actions">
        <button className="btn" onClick={() => st().duplicate(node.id)}>
          <Copy size={13} /> Duplicate
        </button>
        <button className="btn" onClick={() => st().copy(node.id)}>
          <ClipboardCopy size={13} /> Copy
        </button>
        {node.type !== 'section' && (
          <button className="btn" onClick={() => st().wrapInContainer(node.id)}>
            <BoxSelect size={13} /> Wrap
          </button>
        )}
        <button className="btn btn-danger" onClick={() => void st().requestRemove([node.id])}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Body of the page-settings panel. Reused by both the empty-selection Inspector and the "Overall" tab. */
function PagePanelContent({ compact = false }: { compact?: boolean }) {
  const doc = useStore((s) => s.doc);
  const p = doc.page;
  const set = (patch: Partial<typeof p>) => st().setPage(patch);
  const count = Object.keys(doc.nodes).length;
  return (
    <>
      <div className="pad">
        <Field label="Page title">
          <input className="inp" value={p.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Base font">
          <select className="inp" value={p.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f.name} value={f.stack}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Text colour">
          <PlainColor value={p.color} onChange={(v) => set({ color: v })} />
        </Field>
        <Field label="Page background">
          <PlainColor value={p.background} onChange={(v) => set({ background: v })} />
        </Field>
      </div>
      <Group title="Colour tokens">
        <ColorTokens />
      </Group>
      <Group title="Text styles">
        <TextStyles />
      </Group>
      {!compact && (
        <div className="shortcuts">
          <div className="field-l">Shortcuts</div>
          {[
            ['Undo / Redo', 'Ctrl Z · Ctrl ⇧ Z'],
            ['Duplicate', 'Ctrl D'],
            ['Multi-select', 'Shift / Ctrl + click'],
            ['Group selection', 'Ctrl G'],
            ['Copy / Paste', 'Ctrl C · Ctrl V'],
            ['Delete', 'Del'],
            ['Edit text', 'Enter / double-click'],
            ['Select parent', 'Esc'],
            ['Export', 'Ctrl E'],
            ['Adjust value', '↑ ↓ (⇧ ×10) or drag label'],
          ].map(([a, b]) => (
            <div key={a} className="sc">
              <span>{a}</span>
              <kbd>{b}</kbd>
            </div>
          ))}
        </div>
      )}
      {compact && (
        <p className="hint-line" style={{ padding: '0 14px 14px' }}>
          {doc.roots.length} sections · {count} elements
        </p>
      )}
    </>
  );
}

function PageInspector() {
  const doc = useStore((s) => s.doc);
  const count = Object.keys(doc.nodes).length;
  return (
    <div className="insp-scroll">
      <div className="insp-head">
        <div className="insp-icon">
          <Settings2 size={15} />
        </div>
        <div>
          <div className="insp-title">Page settings</div>
          <div className="insp-sub">
            {doc.roots.length} sections · {count} elements
          </div>
        </div>
      </div>
      <PagePanelContent />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ColorTokens() {
  const colors = useStore((s) => s.doc.tokens.colors);
  const doc = useStore((s) => s.doc);
  const uses = (id: string) => {
    const ref = colorRef(id);
    let n = 0;
    for (const node of Object.values(doc.nodes))
      for (const l of [node.styles.desktop, node.styles.tablet, node.styles.mobile, node.styles.hover]) if (l) for (const k in l) if (l[k] === ref) n++;
    return n;
  };
  return (
    <div className="tokens">
      {colors.map((c) => (
        <div key={c.id} className="token">
          <label className="swatch">
            <span style={{ background: c.value }} />
            <input
              type="color"
              value={toHex(c.value)}
              onChange={(e) => st().updateTokens((t) => void (t.colors.find((x) => x.id === c.id)!.value = e.target.value), `c:${c.id}`)}
            />
          </label>
          <input className="inp" value={c.name} onChange={(e) => st().updateTokens((t) => void (t.colors.find((x) => x.id === c.id)!.name = e.target.value), `cn:${c.id}`)} />
          <span className="token-uses" title="Uses">
            {uses(c.id)}
          </span>
          <button
            className="icon-btn"
            title="Delete token (elements keep the colour)"
            onClick={async () => {
              const n = uses(c.id);
              if (n && !(await ask({ title: `Delete “${c.name}”?`, message: `${n} style value${n > 1 ? 's use' : ' uses'} it — they’ll keep ${c.value} but stop updating with the token.`, confirmLabel: 'Delete token', danger: true }))) return;
              st().deleteColorToken(c.id);
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button className="btn btn-sm btn-block" onClick={() => st().addColorToken('#6366f1')}>
        <Plus size={13} /> Add colour
      </button>
      <p className="hint-line">Pick tokens under any colour field. Change a token here and every linked element updates — including exported CSS variables.</p>
    </div>
  );
}

function TextStyles() {
  const styles = useStore((s) => s.doc.tokens.text);
  const nodes = useStore((s) => s.doc.nodes);
  const [open, setOpen] = useState<string | null>(null);
  const upd = (id: string, fn: (t: TextStyleToken) => void, key: string) => st().updateTokens((t) => fn(t.text.find((x) => x.id === id)!), `${key}:${id}`);
  const setLayer = (id: string, layer: 'desktop' | 'tablet' | 'mobile', prop: string, v: string) =>
    upd(
      id,
      (t) => {
        const l = (t[layer] ??= {});
        if (v) l[prop] = normalizeValue(prop, v);
        else delete l[prop];
      },
      `${layer}${prop}`,
    );
  return (
    <div className="tokens">
      {styles.map((t) => {
        const count = Object.values(nodes).filter((n) => n.textStyle === t.id).length;
        return (
          <div key={t.id} className={`tstyle${open === t.id ? ' is-open' : ''}`}>
            <button className="tstyle-head" onClick={() => setOpen(open === t.id ? null : t.id)}>
              <span className="tstyle-sample" style={{ fontFamily: t.desktop.fontFamily, fontWeight: t.desktop.fontWeight as any }}>
                Aa
              </span>
              <span className="tstyle-name">{t.name}</span>
              <span className="token-uses">{t.desktop.fontSize ?? '—'}</span>
              <span className="token-uses">{count}×</span>
            </button>
            {open === t.id && (
              <div className="tstyle-body">
                <input className="inp" value={t.name} onChange={(e) => upd(t.id, (x) => (x.name = e.target.value), 'name')} />
                <select className="inp" value={t.desktop.fontFamily ?? ''} onChange={(e) => setLayer(t.id, 'desktop', 'fontFamily', e.target.value)}>
                  <option value="">Inherit font</option>
                  {FONTS.map((f) => (
                    <option key={f.name} value={f.stack}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div className="per-view">
                  {(['desktop', 'tablet', 'mobile'] as const).map((d) => {
                    const D = DEVICE_META[d];
                    return (
                      <label key={d} title={`${D.label} size`}>
                        <D.icon size={12} />
                        <input value={t[d]?.fontSize ?? ''} placeholder={d === 'desktop' ? '16px' : '—'} onChange={(e) => setLayer(t.id, d, 'fontSize', e.target.value)} />
                      </label>
                    );
                  })}
                </div>
                <div className="pair">
                  <select className="inp" value={t.desktop.fontWeight ?? ''} onChange={(e) => setLayer(t.id, 'desktop', 'fontWeight', e.target.value)}>
                    <option value="">Weight</option>
                    {WEIGHTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input className="inp" placeholder="Line height" value={t.desktop.lineHeight ?? ''} onChange={(e) => setLayer(t.id, 'desktop', 'lineHeight', e.target.value)} />
                  <input className="inp" placeholder="Letter spacing" value={t.desktop.letterSpacing ?? ''} onChange={(e) => setLayer(t.id, 'desktop', 'letterSpacing', e.target.value)} />
                  <select className="inp" value={t.desktop.textTransform ?? ''} onChange={(e) => setLayer(t.id, 'desktop', 'textTransform', e.target.value)}>
                    <option value="">Case</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    if (count && !(await ask({ title: `Delete “${t.name}”?`, message: `${count} element${count > 1 ? 's keep' : ' keeps'} its look but will no longer be linked.`, confirmLabel: 'Delete style', danger: true }))) return;
                    st().deleteTextStyle(t.id);
                  }}
                >
                  <Trash2 size={12} /> Delete style
                </button>
              </div>
            )}
          </div>
        );
      })}
      {!styles.length && <p className="hint-line">No text styles yet. Select a text element and use “+” next to Text style to save one.</p>}
    </div>
  );
}

function MultiPanel() {
  const ids = useStore((s) => [s.selectedId, ...s.multi].filter(Boolean).join(','));
  const doc = useStore((s) => s.doc);
  const list = ids.split(',').map((id) => doc.nodes[id]).filter(Boolean);
  const sameParent = list.every((n) => n.parent && n.parent === list[0].parent);
  return (
    <div className="insp-scroll">
      <div className="insp-head">
        <div className="insp-icon">
          <BoxSelect size={15} />
        </div>
        <div>
          <div className="insp-title">{list.length} elements selected</div>
          <div className="insp-sub">Shift/Ctrl-click to add or remove · Esc to clear</div>
        </div>
      </div>
      <div className="pad">
        <div className="multi-list">
          {list.map((n) => {
            const I = ELEMENTS[n.type].icon;
            return (
              <div key={n.id}>
                <I size={13} /> {n.name}
              </div>
            );
          })}
        </div>
        <div className="actions">
          <button className="btn" onClick={() => st().duplicateMany(st().selection())}>
            <Copy size={13} /> Duplicate
          </button>
          <button className="btn" disabled={!sameParent} title={sameParent ? 'Wrap in a new container (Ctrl+G)' : 'Only siblings can be grouped'} onClick={() => st().groupSelection()}>
            <BoxSelect size={13} /> Group
          </button>
          <button className="btn" onClick={() => st().select(st().selectedId)}>
            <X size={13} /> Clear
          </button>
          <button className="btn btn-danger" onClick={() => void st().requestRemove()}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Top-level mode switch shown above the per-node tabs when a node is selected. */
function ModeSwitch({ mode }: { mode: InspectorMode }) {
  return (
    <div className="imode">
      <button className={mode === 'element' ? 'is-on' : ''} onClick={() => st().setInspectorMode('element')}>
        <Layers size={13} /> Element
      </button>
      <button className={mode === 'overall' ? 'is-on' : ''} onClick={() => st().setInspectorMode('overall')}>
        <Sliders size={13} /> Overall
      </button>
    </div>
  );
}

export function Inspector() {
  const node = useSelectedNode();
  const tab = useStore((s) => s.inspectorTab);
  const mode = useStore((s) => s.inspectorMode);
  const device = useStore((s) => s.device);
  const styleState = useStore((s) => s.styleState);
  const dev = useDev();
  const multiCount = useStore((s) => s.multi.length);

  // No selection → the full page-settings panel (unchanged behaviour).
  if (!node) {
    return (
      <aside className="right">
        <PageInspector />
      </aside>
    );
  }
  // Multi-select → the group panel (unchanged behaviour).
  if (multiCount) {
    return (
      <aside className="right">
        <MultiPanel />
      </aside>
    );
  }

  const def = ELEMENTS[node.type];
  const hasContent = !['row', 'divider', 'spacer'].includes(node.type);
  const cur = tab === 'content' && !hasContent ? 'style' : tab;
  const tabs = [
    ...(hasContent ? [{ id: 'content', label: 'Content', icon: PenLine }] : []),
    { id: 'style', label: 'Style', icon: Paintbrush },
    { id: 'shopify', label: 'Shopify', icon: ShoppingBag },
    { id: 'advanced', label: dev ? 'Advanced' : 'More', icon: Settings2 },
  ] as const;

  return (
    <aside className="right">
      <div className="insp-head">
        <div className="insp-icon">
          <def.icon size={15} />
        </div>
        <div className="insp-headtext">
          <input className="insp-name" value={node.name} onChange={(e) => st().updateNode(node.id, { name: e.target.value })} />
          <div className="insp-sub">
            {def.label}
            {dev && (
              <>
                {' · '}
                <code>.{classAttr(node).split(' ')[0]}</code>
              </>
            )}
          </div>
        </div>
      </div>

      <ModeSwitch mode={mode} />

      {mode === 'overall' ? (
        <div className="insp-scroll" key={`overall:${node.id}`}>
          <PagePanelContent compact />
        </div>
      ) : (
        <>
          <div className="itabs">
            {tabs.map((t) => (
              <button key={t.id} className={cur === t.id ? 'is-on' : ''} onClick={() => st().setInspectorTab(t.id as InspectorTab)}>
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="insp-scroll" key={`${node.id}:${device}:${styleState}:${cur}`}>
            {cur === 'content' && <ContentTab node={node} />}
            {cur === 'style' && <StyleTab node={node} />}
            {cur === 'shopify' && <ShopifyTab node={node} />}
            {cur === 'advanced' && <AdvancedTab node={node} />}
          </div>
        </>
      )}
    </aside>
  );
}