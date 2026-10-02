import type { Doc } from './types';
import { DEFAULT_PAGE } from './doc';
import { uid } from './lib/util';

/**
 * Document schema versioning.
 *
 * Every saved project carries `version`. When the shape of `Doc` changes, bump DOC_VERSION and add
 * a step to MIGRATIONS that upgrades version N → N+1. `migrateDoc` runs the steps in order, so a
 * project saved by any older build opens in the current one. Files from a *newer* build are refused
 * rather than silently truncated.
 */
export const DOC_VERSION = 2;

export class NewerVersionError extends Error {
  constructor(v: number) {
    super(`This project was saved by a newer version of SectionForge (format v${v}). Update the app to open it.`);
  }
}

const MIGRATIONS: Record<number, (d: any) => void> = {
  // v1 → v2: projects get an identity + timestamps, and design tokens
  1: (d) => {
    d.id ??= uid();
    d.createdAt ??= Date.now();
    d.updatedAt ??= d.createdAt;
    d.tokens ??= { colors: [], text: [] };
  },
};

export function migrateDoc(raw: unknown): Doc {
  if (!raw || typeof raw !== 'object') throw new Error('Not a SectionForge project.');
  const d: any = structuredClone(raw);
  if (typeof d.nodes !== 'object' || !d.nodes || !Array.isArray(d.roots)) throw new Error('Not a SectionForge project.');

  let v: number = typeof d.version === 'number' ? d.version : 1;
  if (v > DOC_VERSION) throw new NewerVersionError(v);
  while (v < DOC_VERSION) {
    MIGRATIONS[v]?.(d);
    v++;
  }
  d.version = DOC_VERSION;

  // Structural repair: never let a dangling reference crash the editor.
  d.name = typeof d.name === 'string' && d.name.trim() ? d.name : 'Untitled project';
  d.page = { ...DEFAULT_PAGE, ...(d.page || {}) };
  d.tokens = { colors: d.tokens?.colors ?? [], text: d.tokens?.text ?? [] };
  d.roots = d.roots.filter((id: string) => d.nodes[id]);
  for (const n of Object.values<any>(d.nodes)) {
    n.children = (n.children || []).filter((c: string) => d.nodes[c]);
    n.styles ??= { desktop: {} };
    n.styles.desktop ??= {};
    n.props ??= {};
  }
  return d as Doc;
}
