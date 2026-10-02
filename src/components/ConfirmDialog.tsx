import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useUI } from '../ui';

export function ConfirmDialog() {
  const req = useUI((s) => s.confirmReq);
  const answer = useUI((s) => s.answer);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        answer(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [req, answer]);

  if (!req) return null;
  return (
    <div className="modal-bg confirm-bg" onMouseDown={() => answer(false)}>
      <div className="modal confirm" role="alertdialog" aria-modal onMouseDown={(e) => e.stopPropagation()}>
        {req.danger && (
          <div className="confirm-icon">
            <AlertTriangle size={18} />
          </div>
        )}
        <h3>{req.title}</h3>
        {req.message && <p>{req.message}</p>}
        <div className="confirm-actions">
          <button className="btn" onClick={() => answer(false)}>
            Cancel
          </button>
          <button ref={okRef} className={`btn ${req.danger ? 'btn-solid-danger' : 'btn-accent'}`} onClick={() => answer(true)}>
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
