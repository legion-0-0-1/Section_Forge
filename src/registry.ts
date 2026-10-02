import {
  Box,
  Code,
  Columns2,
  Film,
  GalleryHorizontal,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  List,
  Minus,
  MousePointerClick,
  MoveHorizontal,
  MoveVertical,
  Pilcrow,
  RectangleHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { BNode, ElementType, Style } from './types';

export interface ElementDef {
  label: string;
  icon: LucideIcon;
  container?: boolean;
  props: Record<string, any>;
  style: Style;
  tablet?: Style;
  mobile?: Style;
  hover?: Style;
}

export const unsplash = (id: string, w = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const DEFAULT_IMAGE = unsplash('photo-1441986300917-64674bd600d8');

export const ELEMENTS: Record<ElementType, ElementDef> = {
  section: {
    label: 'Section',
    icon: RectangleHorizontal,
    container: true,
    props: { tag: 'section' },
    style: {
      paddingTop: '88px',
      paddingBottom: '88px',
      paddingLeft: '24px',
      paddingRight: '24px',
      backgroundColor: '#ffffff',
    },
    tablet: { paddingTop: '72px', paddingBottom: '72px' },
    mobile: { paddingTop: '56px', paddingBottom: '56px', paddingLeft: '20px', paddingRight: '20px' },
  },
  container: {
    label: 'Container',
    icon: Box,
    container: true,
    props: { tag: 'div' },
    style: { display: 'flex', flexDirection: 'column', gap: '16px' },
  },
  row: {
    label: 'Columns',
    icon: Columns2,
    container: true,
    props: {},
    style: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '24px' },
    mobile: { flexDirection: 'column' },
  },
  grid: {
    label: 'Grid',
    icon: LayoutGrid,
    container: true,
    props: {},
    style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' },
    tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    mobile: { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  marquee: {
    label: 'Marquee',
    icon: MoveHorizontal,
    container: true,
    props: { speed: 30, direction: 'left', pauseOnHover: true, copies: 2 },
    style: { gap: '56px', paddingTop: '8px', paddingBottom: '8px' },
    tablet: { gap: '40px' },
    mobile: { gap: '32px' },
  },
  slider: {
    label: 'Slideshow',
    icon: GalleryHorizontal,
    container: true,
    props: { perView: { desktop: 3, tablet: 2, mobile: 1 }, autoplay: 0, loop: true, arrows: true, dots: true },
    style: { gap: '20px' },
    mobile: { gap: '14px' },
  },
  heading: {
    label: 'Heading',
    icon: Heading,
    props: { text: 'A compelling headline', level: 2 },
    style: {
      fontSize: '40px',
      fontWeight: '700',
      lineHeight: '1.15',
      letterSpacing: '-0.02em',
      color: '#0f172a',
    },
    tablet: { fontSize: '34px' },
    mobile: { fontSize: '28px' },
  },
  text: {
    label: 'Text',
    icon: Pilcrow,
    props: {
      text: 'Tell your story here. Keep it short, specific and focused on what your customer gets.',
      tag: 'p',
    },
    style: { fontSize: '17px', lineHeight: '1.65', color: '#475569' },
    mobile: { fontSize: '16px' },
  },
  button: {
    label: 'Button',
    icon: MousePointerClick,
    props: { text: 'Get started', href: '#', newTab: false },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingTop: '14px',
      paddingBottom: '14px',
      paddingLeft: '26px',
      paddingRight: '26px',
      backgroundColor: '#111827',
      color: '#ffffff',
      fontSize: '15px',
      fontWeight: '600',
      lineHeight: '1.2',
      borderRadius: '10px',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
    },
    hover: { backgroundColor: '#1f2937', transform: 'translateY(-1px)' },
  },
  link: {
    label: 'Link',
    icon: Link,
    props: { text: 'Learn more →', href: '#', newTab: false },
    style: {
      alignSelf: 'flex-start',
      color: '#4f46e5',
      fontSize: '15px',
      fontWeight: '600',
      textDecoration: 'none',
    },
    hover: { textDecoration: 'underline' },
  },
  list: {
    label: 'List',
    icon: List,
    props: { items: ['First benefit worth mentioning', 'Second benefit worth mentioning', 'Third benefit worth mentioning'], ordered: false },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      paddingLeft: '20px',
      color: '#475569',
      fontSize: '16px',
      lineHeight: '1.6',
    },
  },
  icon: {
    label: 'Icon',
    icon: Sparkles,
    props: { icon: 'Sparkles', size: 22, stroke: 1.75 },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      backgroundColor: '#eef2ff',
      color: '#4f46e5',
    },
  },
  image: {
    label: 'Image',
    icon: ImageIcon,
    props: { src: DEFAULT_IMAGE, alt: '' },
    style: { display: 'block', width: '100%', height: 'auto', objectFit: 'cover', borderRadius: '12px' },
  },
  video: {
    label: 'Video',
    icon: Film,
    props: { url: 'https://www.youtube.com/watch?v=_9VUPq3SxOc' },
    style: {
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
  },
  embed: {
    label: 'Custom HTML',
    icon: Code,
    props: {
      html: '<div style="padding:24px;border:1px dashed #cbd5e1;border-radius:12px;text-align:center;color:#64748b;font-size:14px">Custom HTML block — edit me in the Content tab</div>',
    },
    style: {},
  },
  divider: {
    label: 'Divider',
    icon: Minus,
    props: {},
    style: { width: '100%', height: '1px', borderStyle: 'none', backgroundColor: '#e5e7eb' },
  },
  spacer: {
    label: 'Spacer',
    icon: MoveVertical,
    props: {},
    style: { height: '48px' },
    mobile: { height: '32px' },
  },
};

export const isContainer = (t: ElementType) => !!ELEMENTS[t].container;

export const TEXT_TYPES = new Set<ElementType>(['heading', 'text', 'button', 'link']);

export function tagOf(n: BNode): string {
  switch (n.type) {
    case 'section':
      return n.props.tag || 'section';
    case 'container':
      return n.props.tag || 'div';
    case 'heading':
      return `h${n.props.level || 2}`;
    case 'text':
      return n.props.tag || 'p';
    case 'button':
    case 'link':
      return 'a';
    case 'list':
      return n.props.ordered ? 'ol' : 'ul';
    case 'icon':
      return 'span';
    case 'image':
      return 'img';
    case 'divider':
      return 'hr';
    default:
      return 'div';
  }
}
