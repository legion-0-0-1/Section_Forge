import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { useStore } from './store';
import { TEXT_TYPES } from './registry';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { ExportModal } from './components/ExportModal';
import { PreviewModal } from './components/PreviewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAutoScroll } from './dnd';
import { Home } from './components/Home';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Tutorial } from './components/Tutorial';
import { useUI } from './ui';

/** Any modal variant that should render the ExportModal. */
const isExportModal = (m: ReturnType<typeof useStore.getState>['modal']) =>
  m === 'export-liquid' || m === 'export-html' || m === 'export-css';

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = !!t.closest?.('input, textarea, select, [contenteditable="true"]');
      const s = useStore.getState();
      const ui = useUI.getState();
      // While the tutorial is open, only its own handlers should run.
      if (ui.tutorialStep !== null) return;
      if (s.screen !== 'editor' || ui.confirmReq) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && k === 'y' && !typing) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && k === 'e') {
        e.preventDefault();
        if (isExportModal(s.modal)) s.setModal(null);
        else s.setModal(s.lastExportKind ?? 'export-liquid');
        return;
      }
      if (k === 'escape') {
        if (s.modal) s.setModal(null);
        else if (!typing && s.multi.length) s.select(s.selectedId);
        else if (!typing && s.selectedId) s.select(s.doc.nodes[s.selectedId]?.parent ?? null);
        return;
      }
      if (typing || s.modal) return;
      const sel = s.selectedId ? s.doc.nodes[s.selectedId] : null;
      if (mod && k === 'd' && sel) {
        e.preventDefault();
        s.duplicateMany(s.selection());
      } else if (mod && k === 'g' && sel) {
        e.preventDefault();
        s.groupSelection();
      } else if (mod && k === 'c' && sel) {
        s.copy(sel.id);
      } else if (mod && k === 'v') {
        s.paste();
      } else if ((k === 'delete' || k === 'backspace') && sel) {
        e.preventDefault();
        void s.requestRemove();
      } else if (k === 'enter' && sel && TEXT_TYPES.has(sel.type)) {
        e.preventDefault();
        s.setEditing(sel.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Toast() {
  const msg = useStore((s) => s.toastMsg);
  return msg ? <div className="toast">{msg}</div> : null;
}

export default function App() {
  const screen = useStore((s) => s.screen);
  return (
    <>
      {screen === 'home' ? <Home /> : <Editor />}
      <ConfirmDialog />
      <Toast />
      <Analytics />
    </>
  );
}

function Editor() {
  useKeyboard();
  const modal = useStore((s) => s.modal);
  const dragging = useStore((s) => !!s.dragging);

  // First-run tour: offer it once, the first time the editor opens and the tutorial hasn't been seen.
  const tutorialSeen = useUI((s) => s.tutorialSeen);
  const startTutorial = useUI((s) => s.startTutorial);
  useEffect(() => {
    if (tutorialSeen) return;
    // Small delay so the panels have painted before the tour measures anchors.
    const id = window.setTimeout(() => {
      // Guard against the user having opened/closed multiple projects in the meantime.
      if (useStore.getState().screen !== 'editor') return;
      startTutorial(0);
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => (dragging ? startAutoScroll() : undefined), [dragging]);
  return (
    <div className={`app${dragging ? ' is-dragging' : ''}`}>
      <TopBar />
      <ErrorBoundary area="panel" gridArea="left" compact>
        <LeftPanel />
      </ErrorBoundary>
      <ErrorBoundary area="canvas" gridArea="canvas">
        <Canvas />
      </ErrorBoundary>
      <ErrorBoundary area="inspector" gridArea="right" compact>
        <Inspector />
      </ErrorBoundary>
      <ErrorBoundary area="export" gridArea="canvas" compact>
        {isExportModal(modal) && <ExportModal />}
        {modal === 'preview' && <PreviewModal />}
      </ErrorBoundary>
      <Tutorial />
    </div>
  );
}