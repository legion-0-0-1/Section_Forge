import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadEditorFonts } from './lib/fonts';
import { bootstrapProjects } from './projects';
import './ui';
import './styles.css';

loadEditorFonts();
bootstrapProjects();

if (import.meta.env.DEV) {
  // handy for debugging in the console; stripped from production builds
  Promise.all([import('./store'), import('./ui'), import('./templates'), import('./doc'), import('./export/html'), import('./export/liquid')]).then(
    ([s, u, t, d, h, l]) => Object.assign(window, { __ss: { useStore: s.useStore, useUI: u.useUI, ...t, ...d, ...h, ...l } }),
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary area="editor">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
