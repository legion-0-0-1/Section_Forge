import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Download, RotateCcw, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { downloadText, slug } from '../lib/util';

interface Props {
  area: string;
  children: ReactNode;
  compact?: boolean;
  /** grid-area to occupy when showing the fallback inside the editor grid */
  gridArea?: string;
}
interface State {
  error: Error | null;
}

/** Keeps one broken panel from blanking the whole editor, and offers a way out. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SectionForge] ${this.props.area} crashed`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private undo = () => {
    useStore.getState().undo();
    this.reset();
  };

  private backup = () => {
    const d = useStore.getState().doc;
    downloadText(`${slug(d.name)}-backup.sectionforge.json`, JSON.stringify(d, null, 2), 'application/json');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const canUndo = useStore.getState().past.length > 0;
    return (
      <div className={`crash${this.props.compact ? ' is-compact' : ''}`} role="alert" style={{ gridArea: this.props.gridArea }}>
        <div className="crash-icon">
          <AlertTriangle size={20} />
        </div>
        <h3>The {this.props.area} hit an error</h3>
        <p>Your work is autosaved. Undoing the last change usually fixes this.</p>
        <code>{error.message}</code>
        <div className="crash-actions">
          {canUndo && (
            <button className="btn btn-accent" onClick={this.undo}>
              <Undo2 size={14} /> Undo last change
            </button>
          )}
          <button className="btn" onClick={this.reset}>
            <RotateCcw size={14} /> Try again
          </button>
          <button className="btn" onClick={this.backup}>
            <Download size={14} /> Download backup
          </button>
        </div>
      </div>
    );
  }
}
