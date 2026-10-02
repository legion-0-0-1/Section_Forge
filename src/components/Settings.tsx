import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { ACCENTS, THEMES, useUI, type ThemeId } from '../ui';
import { toHex } from './controls';
import { Switch } from './controls';

/** Editor appearance: theme, accent, and Simple/Developer mode. Affects the app, not the design. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, accent, mode, setTheme, setAccent, setMode } = useUI();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button className="icon-btn" title="Editor appearance" onClick={() => setOpen(!open)}>
        <Palette size={16} />
      </button>
      {open && (
        <div className="menu-pop right settings-pop">
          <div className="sp-title">Editor appearance</div>
          <div className="sp-sub">Only changes SectionForge’s interface — not your designs.</div>
          <div className="sp-label">Theme</div>
          <div className="themes">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id];
              return (
                <button key={id} className={`theme-card${theme === id ? ' is-on' : ''}`} onClick={() => setTheme(id)}>
                  <span className="theme-prev" style={{ background: t.vars.bg, borderColor: t.vars['border-2'] }}>
                    <i style={{ background: t.vars.panel }} />
                    <i style={{ background: t.vars['canvas-bg'] }}>
                      <em style={{ background: accent }} />
                    </i>
                    <i style={{ background: t.vars.panel }} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="sp-label">Accent</div>
          <div className="accents">
            {ACCENTS.map((c) => (
              <button key={c} className="accent-dot" style={{ background: c }} onClick={() => setAccent(c)} title={c}>
                {accent.toLowerCase() === c && <Check size={12} />}
              </button>
            ))}
            <label className="accent-dot custom" title="Custom colour" style={{ background: ACCENTS.includes(accent) ? undefined : accent }}>
              <input type="color" value={toHex(accent)} onChange={(e) => setAccent(e.target.value)} />
              {!ACCENTS.includes(accent) && <Check size={12} />}
            </label>
          </div>
          <div className="sp-sep" />
          <Switch
            on={mode === 'developer'}
            onChange={(v) => setMode(v ? 'developer' : 'simple')}
            label="Developer mode"
            desc="Show CSS terminology, custom properties, classes/IDs and advanced layout controls."
          />
        </div>
      )}
    </div>
  );
}
