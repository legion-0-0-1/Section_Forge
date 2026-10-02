import { create } from 'zustand';

/**
 * Editor-only preferences (theme, accent, mode) and transient chrome state (tutorial, confirm).
 * These style the SectionForge app itself — never the page being designed — and live in
 * localStorage per browser.
 */
const UI_KEY = 'sectionforge:ui';
const TUTORIAL_KEY = 'sectionforge:tutorial-seen';

export type ThemeId = 'midnight' | 'graphite' | 'slate' | 'light';
export type Mode = 'simple' | 'developer';

interface ThemeDef {
  label: string;
  light?: boolean;
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  midnight: {
    label: 'Midnight',
    vars: {
      bg: '#0b0c0f', panel: '#121318', 'panel-2': '#17191f', 'panel-3': '#1d2027', hover: '#22252d',
      border: '#23262e', 'border-2': '#2d3039', text: '#e8e9ed', 'text-2': '#a3a7b3', 'text-3': '#6b6f7c',
      'canvas-bg': '#0e0f13', 'canvas-dot': 'rgba(255,255,255,0.055)', code: '#0a0b0e',
    },
  },
  graphite: {
    label: 'Graphite',
    vars: {
      bg: '#161616', panel: '#1e1e1e', 'panel-2': '#242424', 'panel-3': '#2b2b2b', hover: '#313131',
      border: '#2e2e2e', 'border-2': '#3a3a3a', text: '#ececec', 'text-2': '#b0b0b0', 'text-3': '#7a7a7a',
      'canvas-bg': '#1a1a1a', 'canvas-dot': 'rgba(255,255,255,0.06)', code: '#131313',
    },
  },
  slate: {
    label: 'Slate',
    vars: {
      bg: '#0c1220', panel: '#111a2b', 'panel-2': '#162033', 'panel-3': '#1c283d', hover: '#223049',
      border: '#1f2b40', 'border-2': '#2a3852', text: '#e6ebf5', 'text-2': '#9ba8c0', 'text-3': '#66748e',
      'canvas-bg': '#0e1626', 'canvas-dot': 'rgba(160,190,255,0.07)', code: '#0a101c',
    },
  },
  light: {
    label: 'Daylight',
    light: true,
    vars: {
      bg: '#eef0f3', panel: '#ffffff', 'panel-2': '#f6f7f9', 'panel-3': '#eceef2', hover: '#e6e9ee',
      border: '#e2e5ea', 'border-2': '#d3d7de', text: '#15171c', 'text-2': '#4a5160', 'text-3': '#8a91a1',
      'canvas-bg': '#e4e6eb', 'canvas-dot': 'rgba(0,0,0,0.07)', code: '#0f1117',
    },
  },
};

export const ACCENTS = ['#7c6cff', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#a3a3a3'];

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface UIState {
  theme: ThemeId;
  accent: string;
  mode: Mode;
  confirmReq: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  /** Index of the active tutorial step, or null when the tutorial isn't open. */
  tutorialStep: number | null;
  /** True once the tutorial has been completed or dismissed at least once. */
  tutorialSeen: boolean;
  setTheme: (t: ThemeId) => void;
  setAccent: (c: string) => void;
  setMode: (m: Mode) => void;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  answer: (ok: boolean) => void;
  /** Open the tutorial at step 0 (or the given step). */
  startTutorial: (step?: number) => void;
  /** Close the tutorial and mark it seen. */
  endTutorial: () => void;
  /** Advance to the next step (or close at the end). */
  nextStep: () => void;
  /** Go back one step (no-op at the first step). */
  prevStep: () => void;
}

function load(): Pick<UIState, 'theme' | 'accent' | 'mode'> {
  const def = { theme: 'midnight' as ThemeId, accent: ACCENTS[0], mode: 'simple' as Mode };
  try {
    const v = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
    return {
      theme: v.theme in THEMES ? v.theme : def.theme,
      accent: /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent : def.accent,
      mode: v.mode === 'developer' ? 'developer' : def.mode,
    };
  } catch {
    return def;
  }
}

function readTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export const useUI = create<UIState>()((set, get) => ({
  ...load(),
  confirmReq: null,
  tutorialStep: null,
  tutorialSeen: readTutorialSeen(),
  setTheme: (theme) => set({ theme }),
  setAccent: (accent) => set({ accent }),
  setMode: (mode) => set({ mode }),
  ask: (o) =>
    new Promise<boolean>((resolve) => {
      get().confirmReq?.resolve(false);
      set({ confirmReq: { ...o, resolve } });
    }),
  answer: (ok) => {
    get().confirmReq?.resolve(ok);
    set({ confirmReq: null });
  },
  startTutorial: (step = 0) => set({ tutorialStep: step }),
  endTutorial: () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
      /* private mode / quota — non-fatal */
    }
    set({ tutorialStep: null, tutorialSeen: true });
  },
  nextStep: () => {
    const cur = get().tutorialStep;
    if (cur === null) return;
    // TUTORIAL_STEPS.length is defined in Tutorial.tsx; step past the last one closes the tour.
    // We use a generous upper bound (99) rather than importing the array to avoid a cycle.
    // Tutorial.tsx clamps this via its own bounds check when it reads tutorialStep.
    set({ tutorialStep: cur + 1 });
  },
  prevStep: () => {
    const cur = get().tutorialStep;
    if (cur === null || cur <= 0) return;
    set({ tutorialStep: cur - 1 });
  },
}));

export const ask = (o: ConfirmOptions) => useUI.getState().ask(o);
export const useDev = () => useUI((s) => s.mode === 'developer');

// ---- theme application ------------------------------------------------------------
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (h: string, w: string, t: number) => {
  const a = hexRgb(h);
  const b = hexRgb(w);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const luminance = (h: string) => {
  const [r, g, b] = hexRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function applyTheme(theme: ThemeId, accent: string) {
  const t = THEMES[theme];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(`--${k}`, v);
  const [r, g, b] = hexRgb(accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-2', t.light ? mix(accent, '#000000', 0.12) : mix(accent, '#ffffff', 0.25));
  root.style.setProperty('--accent-bg', `rgba(${r}, ${g}, ${b}, ${t.light ? 0.12 : 0.14})`);
  root.style.setProperty('--accent-line', `rgba(${r}, ${g}, ${b}, 0.55)`);
  root.style.setProperty('--accent-fg', luminance(accent) > 0.45 ? '#111111' : '#ffffff');
  root.style.colorScheme = t.light ? 'light' : 'dark';
  root.dataset.theme = t.light ? 'light' : 'dark';
}

applyTheme(useUI.getState().theme, useUI.getState().accent);
useUI.subscribe((s, p) => {
  if (s.theme !== p.theme || s.accent !== p.accent) applyTheme(s.theme, s.accent);
  if (s.theme !== p.theme || s.accent !== p.accent || s.mode !== p.mode) {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ theme: s.theme, accent: s.accent, mode: s.mode }));
    } catch {
      /* ignore */
    }
  }
});