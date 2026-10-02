export interface FontDef {
  name: string;
  stack: string;
  google: boolean;
  weights: string;
}

const g = (name: string, fallback: string, weights = '400;500;600;700;800'): FontDef => ({
  name,
  stack: `'${name}', ${fallback}`,
  google: true,
  weights,
});

export const FONTS: FontDef[] = [
  g('Inter', 'system-ui, sans-serif'),
  g('DM Sans', 'system-ui, sans-serif'),
  g('Manrope', 'system-ui, sans-serif'),
  g('Plus Jakarta Sans', 'system-ui, sans-serif'),
  g('Outfit', 'system-ui, sans-serif'),
  g('Poppins', 'system-ui, sans-serif'),
  g('Space Grotesk', 'system-ui, sans-serif', '400;500;600;700'),
  g('Playfair Display', 'Georgia, serif'),
  g('Fraunces', 'Georgia, serif'),
  g('Lora', 'Georgia, serif', '400;500;600;700'),
  g('Cormorant Garamond', 'Georgia, serif', '400;500;600;700'),
  { name: 'System UI', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", google: false, weights: '' },
  { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif", google: false, weights: '' },
];

export function fontNameFromStack(stack: string): string {
  return (stack || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

export function googleFontsHref(names: string[]): string | null {
  const defs = FONTS.filter((f) => f.google && names.includes(f.name));
  if (!defs.length) return null;
  const fam = defs.map((f) => `family=${f.name.replace(/ /g, '+')}:wght@${f.weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

/** Load every bundled font into the editor once. */
export function loadEditorFonts() {
  if (document.getElementById('ss-editor-fonts')) return;
  const href = googleFontsHref(FONTS.map((f) => f.name));
  if (!href) return;
  const link = document.createElement('link');
  link.id = 'ss-editor-fonts';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
