import {
  Box,
  Code,
  Columns2,
  Columns3,
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
import { el, WRAP } from './doc';
import { unsplash } from './registry';
import type { TreeSpec } from './types';

export interface PaletteItem {
  id: string;
  label: string;
  icon: LucideIcon;
  spec: () => TreeSpec;
}

const col = () => el('container', { name: 'Column', style: { flex: '1 1 0', minWidth: '0' } });

export const PALETTE: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'Layout',
    items: [
      {
        id: 'section',
        label: 'Section',
        icon: RectangleHorizontal,
        spec: () => el('section', {}, [el('container', { name: 'Wrapper', style: WRAP })]),
      },
      { id: 'container', label: 'Container', icon: Box, spec: () => el('container') },
      { id: 'cols2', label: '2 Columns', icon: Columns2, spec: () => el('row', {}, [col(), col()]) },
      { id: 'cols3', label: '3 Columns', icon: Columns3, spec: () => el('row', {}, [col(), col(), col()]) },
      {
        id: 'grid',
        label: 'Grid',
        icon: LayoutGrid,
        spec: () =>
          el('grid', {}, [
            el('container', { name: 'Cell' }),
            el('container', { name: 'Cell' }),
            el('container', { name: 'Cell' }),
          ]),
      },
      {
        id: 'marquee',
        label: 'Marquee',
        icon: MoveHorizontal,
        spec: () =>
          el(
            'marquee',
            {},
            ['Free shipping', 'New arrivals weekly', '30-day returns', 'Carbon neutral'].map((t) =>
              el('text', { name: 'Item', props: { text: t }, style: { fontSize: '15px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: '1.4' } }),
            ),
          ),
      },
      {
        id: 'slider',
        label: 'Slideshow',
        icon: GalleryHorizontal,
        spec: () =>
          el(
            'slider',
            {},
            [
              'photo-1505740420928-5e560c06d30e',
              'photo-1542291026-7eec264c27ff',
              'photo-1523275335684-37898b6baf30',
              'photo-1526170375885-4d8ecf77b99f',
              'photo-1491553895911-0055eca6402d',
            ].map((id) => el('image', { name: 'Slide', props: { src: unsplash(id, 900), alt: '' }, style: { aspectRatio: '4 / 5', borderRadius: '16px' } })),
          ),
      },
      { id: 'spacer', label: 'Spacer', icon: MoveVertical, spec: () => el('spacer') },
      { id: 'divider', label: 'Divider', icon: Minus, spec: () => el('divider') },
    ],
  },
  {
    title: 'Content',
    items: [
      { id: 'heading', label: 'Heading', icon: Heading, spec: () => el('heading') },
      { id: 'text', label: 'Text', icon: Pilcrow, spec: () => el('text') },
      { id: 'button', label: 'Button', icon: MousePointerClick, spec: () => el('button') },
      { id: 'link', label: 'Link', icon: Link, spec: () => el('link') },
      { id: 'list', label: 'List', icon: List, spec: () => el('list') },
      { id: 'icon', label: 'Icon', icon: Sparkles, spec: () => el('icon') },
    ],
  },
  {
    title: 'Media',
    items: [
      { id: 'image', label: 'Image', icon: ImageIcon, spec: () => el('image') },
      { id: 'video', label: 'Video', icon: Film, spec: () => el('video') },
      { id: 'embed', label: 'HTML', icon: Code, spec: () => el('embed') },
    ],
  },
];
