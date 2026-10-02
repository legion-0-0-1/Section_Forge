export type Device = 'desktop' | 'tablet' | 'mobile';

export type ElementType =
  | 'section'
  | 'container'
  | 'row'
  | 'grid'
  | 'marquee'
  | 'slider'
  | 'heading'
  | 'text'
  | 'button'
  | 'link'
  | 'list'
  | 'icon'
  | 'image'
  | 'video'
  | 'embed'
  | 'divider'
  | 'spacer';

/** camelCase CSS property -> value */
export type Style = Record<string, string>;

export type StyleTarget = Device | 'hover';

export interface NodeStyles {
  desktop: Style;
  tablet?: Style;
  mobile?: Style;
  hover?: Style;
}

export interface LiquidOptions {
  /** Content nodes: expose as a theme editor setting (default true) */
  expose?: boolean;
  /** Setting label override */
  label?: string;
  /** Containers: children become repeatable blocks */
  blocks?: boolean;
  blockName?: string;
  /** Root sections */
  sectionName?: string;
  bgSetting?: boolean;
  paddingSettings?: boolean;
  /**
   * Section-level design settings exposed to the theme editor.
   * Each one emits TWO schema settings (desktop + mobile) so merchants can
   * tune the section per breakpoint.
   */
  design?: {
    background?: boolean;
    text?: boolean;
    padding?: boolean;
    margin?: boolean;
  };
}

export interface BNode {
  id: string;
  type: ElementType;
  name: string;
  props: Record<string, any>;
  styles: NodeStyles;
  children: string[];
  parent: string | null;
  className?: string;
  htmlId?: string;
  hidden?: Partial<Record<Device, boolean>>;
  liquid?: LiquidOptions;
  /** id of a TextStyleToken */
  textStyle?: string;
  entrance?: EntranceAnim;
  /** containers: extra delay (ms) per animated child */
  stagger?: number;
}

export interface PageSettings {
  title: string;
  fontFamily: string;
  color: string;
  background: string;
}

export interface ColorToken {
  id: string;
  name: string;
  value: string;
}

/** A named, reusable set of typography values (linked: editing it updates every user). */
export interface TextStyleToken {
  id: string;
  name: string;
  desktop: Style;
  tablet?: Style;
  mobile?: Style;
}

export interface Tokens {
  colors: ColorToken[];
  text: TextStyleToken[];
}

export type EntranceType = 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'blur';

export interface EntranceAnim {
  type: EntranceType;
  /** ms */
  duration: number;
  /** ms */
  delay: number;
  easing: string;
  /** px travelled by slide animations */
  distance: number;
}

/**
 * Persisted document. `version` is bumped whenever the shape changes;
 * src/migrate.ts upgrades older saves step by step.
 */
export interface Doc {
  version: 2;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: Record<string, BNode>;
  roots: string[];
  page: PageSettings;
  tokens: Tokens;
}

/** A detached, fully-resolved node tree (used by palette, templates, clipboard). */
export interface TreeSpec {
  type: ElementType;
  name?: string;
  props: Record<string, any>;
  style: Style;
  tablet: Style;
  mobile: Style;
  hover: Style;
  liquid?: LiquidOptions;
  hidden?: Partial<Record<Device, boolean>>;
  textStyle?: string;
  entrance?: EntranceAnim;
  stagger?: number;
  children: TreeSpec[];
}
