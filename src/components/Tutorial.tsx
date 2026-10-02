import { useEffect, useLayoutEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useUI } from '../ui';
import { useStore } from '../store';

const st = () => useStore.getState();

interface Step {
  /** CSS selector to highlight; omit for a centred card. */
  anchor?: string;
  /** Preferred popover side relative to the anchor. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  title: string;
  body: string;
  /** Optional side-effect when the step is entered (switch tab, clear selection, …). */
  onEnter?: () => void;
}

const STEPS: Step[] = [
  {
    title: 'Welcome to SectionForge',
    body: 'This 60-second tour shows you how to build a section, style it, and export it as HTML or Shopify Liquid. You can leave at any time — press Esc or click “Skip”.',
  },
  {
    anchor: '.ptabs',
    side: 'right',
    title: 'Add elements and sections',
    body: 'Drag from the Elements tab onto the canvas, or click to insert after your selection. Sections are ready-made groups (header, hero, footer…) you can drop in and edit.',
    onEnter: () => st().setLeftTab('elements'),
  },
  {
    anchor: '.canvas',
    side: 'left',
    title: 'Design on the canvas',
    body: 'Click to select, double-click text to edit inline, drag to reorder. Use the device switcher in the top bar to preview tablet and mobile. Shift-click selects multiple elements.',
  },
  {
    anchor: '.right',
    side: 'left',
    title: 'Style in the Inspector',
    body: 'Every element has Content, Style, Shopify, and Advanced tabs. Changes apply to the current device and state (Normal/Hover). “Overall” lets you edit page-wide settings like fonts and colours.',
  },
  {
    anchor: '.top-r',
    side: 'bottom',
    title: 'Preview and export',
    body: 'Preview renders your page in a sandboxed iframe. Export code produces HTML, CSS, or a Shopify Liquid section with an auto-generated schema — the dropdown remembers your last format.',
  },
  {
    title: "You're all set",
    body: 'Everything is stored in this browser and autosaves as you work. Open the File menu to duplicate or download a project, and click the “?” in the top bar to replay this tour.',
  },
];

/** Clamp a popover position so the card always stays inside the viewport. */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function Tutorial() {
  const step = useUI((s) => s.tutorialStep);
  const endTutorial = useUI((s) => s.endTutorial);
  const nextStep = useUI((s) => s.nextStep);
  const prevStep = useUI((s) => s.prevStep);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const active = step !== null ? STEPS[step] : undefined;
  const isLast = step !== null && step >= STEPS.length - 1;

  // Run any per-step side effect exactly once when the step changes.
  useEffect(() => {
    if (!active) return;
    active.onEnter?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Esc closes; ← / → navigate. Block the editor's own shortcuts while the tour is open.
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        endTutorial();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isLast) endTutorial();
        else nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };
    window.addEventListener('keydown', onKey, true); // capture phase — beats the editor's handler
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, isLast, endTutorial, nextStep, prevStep]);

  // Track the anchor's rect as the window/panels resize, and after the onEnter side-effect paints.
  useLayoutEffect(() => {
    if (!active?.anchor) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(active.anchor!);
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [active?.anchor]);

  // Bail out if a later step is requested than we have (e.g. nextStep() overshoots).
  useEffect(() => {
    if (step !== null && step >= STEPS.length) endTutorial();
  }, [step, endTutorial]);

  if (!active) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const CARD_W = 320;
  const GAP = 14;

  // Compute the card position: either centred (no anchor) or next to the anchor's rect.
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const side = active.side ?? 'right';
    let left: number;
    let top: number;
    if (side === 'right') {
      left = rect.right + GAP;
      top = rect.top + rect.height / 2 - 100;
    } else if (side === 'left') {
      left = rect.left - CARD_W - GAP;
      top = rect.top + rect.height / 2 - 100;
    } else if (side === 'top') {
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.top - 180 - GAP;
    } else {
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.bottom + GAP;
    }
    cardStyle = {
      left: clamp(left, GAP, vw - CARD_W - GAP),
      top: clamp(top, GAP, vh - 200),
      width: CARD_W,
    };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Backdrop: dims everything, with a hole over the anchor via box-shadow clipping. */}
      {rect ? (
        <>
          <div className="tour-backdrop" onClick={endTutorial} />
          <div
            className="tour-hole"
            style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
          />
        </>
      ) : (
        <div className="tour-backdrop is-solid" onClick={endTutorial} />
      )}

      <div className="tour-card" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button className="tour-close" onClick={endTutorial} title="Close (Esc)">
          <X size={14} />
        </button>
        <div className="tour-step-count">
          Step {Math.min((step ?? 0) + 1, STEPS.length)} of {STEPS.length}
        </div>
        <h3>{active.title}</h3>
        <p>{active.body}</p>
        <div className="tour-actions">
          <button className="btn btn-ghost btn-sm" onClick={endTutorial}>
            Skip
          </button>
          <span className="tour-spacer" />
          <button className="btn btn-sm" onClick={prevStep} disabled={!step}>
            <ArrowLeft size={13} /> Back
          </button>
          <button className="btn btn-accent btn-sm" onClick={isLast ? endTutorial : nextStep}>
            {isLast ? 'Done' : 'Next'} {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Convenience: replay the tour from step 0. */
export const startTutorial = () => useUI.getState().startTutorial(0);