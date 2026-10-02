import type { BNode, Device, Style } from '../types';

/** Desktop-first breakpoints (aligned with Shopify's Dawn: 750 / 990). */
export const BREAKPOINTS = { tablet: 989, mobile: 749 } as const;
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 390 };

export function resolveStyle(n: BNode, device: Device, hover = false): Style {
  const s: Style = { ...n.styles.desktop };
  if (device !== 'desktop' && n.styles.tablet) Object.assign(s, n.styles.tablet);
  if (device === 'mobile' && n.styles.mobile) Object.assign(s, n.styles.mobile);
  if (hover && n.styles.hover) Object.assign(s, n.styles.hover);
  return s;
}

export const kebab = (k: string) =>
  k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export const camel = (k: string) =>
  k.startsWith('--') ? k.trim() : k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const UNITLESS = new Set([
  'lineHeight',
  'fontWeight',
  'opacity',
  'zIndex',
  'flexGrow',
  'flexShrink',
  'order',
  'flex',
  'aspectRatio',
  'gridColumn',
  'gridRow',
  'gridArea',
]);

/** "24" -> "24px" for length props; leaves everything else alone. */
export function normalizeValue(prop: string, v: string): string {
  const t = (v ?? '').trim();
  if (/^-?\d*\.?\d+$/.test(t) && !UNITLESS.has(prop) && t !== '0') return t + 'px';
  return t;
}

/** Increment the leading number of a CSS value, preserving its unit. */
export function stepValue(prop: string, v: string, delta: number): string | null {
  const m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec((v || '0').trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2] || (UNITLESS.has(prop) ? '' : 'px');
  const decimals = Math.abs(delta) < 1 || /\./.test(m[1]) ? 2 : 0;
  const next = Math.round((num + delta) * 10 ** decimals) / 10 ** decimals;
  return `${next}${unit}`;
}
/** Named width presets shown in the top-bar device menu. */
export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  kind: 'tablet' | 'mobile';
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'ipad-mini', label: 'iPad Mini', width: 744, kind: 'tablet' },
  { id: 'ipad', label: 'iPad', width: 810, kind: 'tablet' },
  { id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, kind: 'tablet' },
  { id: 'ipad-pro-13', label: 'iPad Pro 13"', width: 1024, kind: 'tablet' },
  { id: 'surface-pro', label: 'Surface Pro', width: 912, kind: 'tablet' },
  { id: 'iphone-se', label: 'iPhone SE', width: 375, kind: 'mobile' },
  { id: 'iphone-13-mini', label: 'iPhone 13 mini', width: 375, kind: 'mobile' },
  { id: 'iphone-15', label: 'iPhone 15', width: 393, kind: 'mobile' },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, kind: 'mobile' },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, kind: 'mobile' },
  { id: 'pixel-8-pro', label: 'Pixel 8 Pro', width: 448, kind: 'mobile' },
  { id: 'galaxy-s24', label: 'Galaxy S24', width: 360, kind: 'mobile' },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', width: 384, kind: 'mobile' },
];