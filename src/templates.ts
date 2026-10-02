import { docFromSpecs, el, WRAP } from './doc';
import { unsplash } from './registry';
import type { Doc, Style, TreeSpec } from './types';
import { DEFAULT_ENTRANCE } from './lib/motion';

const rise = (delay = 0) => ({ ...DEFAULT_ENTRANCE, delay });
/** Give every direct child an entrance so the parent's stagger cascades them in. */
const animateKids = (spec: TreeSpec) => {
  spec.children.forEach((c) => (c.entrance = rise()));
  return spec;
};

const SERIF = "'Playfair Display', Georgia, serif";
const GROTESK = "'Space Grotesk', system-ui, sans-serif";

const eyebrow = (text: string, color = '#4f46e5', name = 'Eyebrow') =>
  el('text', {
    name,
    props: { text },
    style: {
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      lineHeight: '1.4',
      color,
    },
    mobile: { fontSize: '12px' },
  });

const heading = (text: string, level: number, style: Style = {}, tablet: Style = {}, mobile: Style = {}, name = 'Heading') =>
  el('heading', { name, props: { text, level }, style, tablet, mobile });

const text = (t: string, style: Style = {}, name = 'Text', mobile: Style = {}) =>
  el('text', { name, props: { text: t }, style, mobile });

const btnLight = (label: string, name = 'Primary button') =>
  el('button', {
    name,
    props: { text: label, href: '/collections/all' },
    style: { backgroundColor: '#ffffff', color: '#0b0b14', alignSelf: '', borderRadius: '999px', paddingLeft: '28px', paddingRight: '28px' },
    hover: { backgroundColor: '#e9e7ff' },
  });

const btnOutline = (label: string, name = 'Secondary button') =>
  el('button', {
    name,
    props: { text: label, href: '#' },
    style: {
      backgroundColor: 'transparent',
      color: '#ffffff',
      alignSelf: '',
      borderRadius: '999px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(255,255,255,0.24)',
      paddingLeft: '28px',
      paddingRight: '28px',
    },
    hover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  });

const sectionHeader = (eb: string, title: string, sub?: string, ebColor?: string) =>
  el(
    'container',
    {
      name: 'Header',
      style: { alignItems: 'center', textAlign: 'center', gap: '14px', maxWidth: '680px', width: '100%', marginLeft: 'auto', marginRight: 'auto' },
    },
    [
      eyebrow(eb, ebColor),
      heading(title, 2, { fontSize: '44px' }, { fontSize: '36px' }, { fontSize: '30px' }),
      ...(sub ? [text(sub, { fontSize: '17px' }, 'Subheading')] : []),
    ],
  );

export interface Template {
  id: string;
  name: string;
  category: string;
  spec: () => TreeSpec;
}

export const TEMPLATES: Template[] = [
  {
    id: 'announcement',
    name: 'Announcement bar',
    category: 'Header',
    spec: () =>
      el(
        'section',
        {
          name: 'Announcement bar',
          style: { paddingTop: '11px', paddingBottom: '11px', backgroundColor: '#111827' },
          tablet: { paddingTop: '11px', paddingBottom: '11px' },
          mobile: { paddingTop: '10px', paddingBottom: '10px' },
          liquid: { sectionName: 'Announcement bar', bgSetting: true },
        },
        [
          el(
            'row',
            { name: 'Bar', style: { ...WRAP, justifyContent: 'center', alignItems: 'center', gap: '10px' }, mobile: { flexDirection: 'row' } },
            [
              text('Free express shipping on orders over $75', { fontSize: '13px', color: '#e5e7eb', fontWeight: '500', lineHeight: '1.4' }, 'Message', { fontSize: '13px' }),
              el('link', {
                name: 'Link',
                props: { text: 'Shop now →', href: '/collections/all' },
                style: { fontSize: '13px', color: '#ffffff', alignSelf: '' },
              }),
            ],
          ),
        ],
      ),
  },
  {
    id: 'header',
    name: 'Header — Logo & nav',
    category: 'Header',
    spec: () => {
      const navLink = (label: string, href: string) =>
        el('link', { name: 'Nav link', props: { text: label, href }, style: { color: '#334155', fontWeight: '500', fontSize: '15px', alignSelf: '' }, hover: { color: '#0f172a', textDecoration: 'none' } });
      return el(
        'section',
        {
          name: 'Header',
          props: { tag: 'header' },
          style: { paddingTop: '18px', paddingBottom: '18px', backgroundColor: '#ffffff', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#eef0f3' },
          tablet: { paddingTop: '16px', paddingBottom: '16px' },
          mobile: { paddingTop: '14px', paddingBottom: '14px' },
          liquid: { sectionName: 'Header', bgSetting: true },
        },
        [
          el('row', { name: 'Bar', style: { ...WRAP, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap', gap: '32px' }, mobile: { flexDirection: 'row', gap: '16px' } }, [
            el('link', {
              name: 'Logo',
              props: { text: 'Northwind', href: '/' },
              style: { fontFamily: GROTESK, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.04em', color: '#0f172a', alignSelf: '' },
              hover: { textDecoration: 'none' },
              mobile: { fontSize: '21px' },
            }),
            el(
              'row',
              { name: 'Navigation', hidden: { mobile: true }, style: { gap: '28px', alignItems: 'center', flexWrap: 'nowrap' }, tablet: { gap: '20px' }, liquid: { blocks: true, blockName: 'Menu link' } },
              [navLink('Shop', '/collections/all'), navLink('New in', '/collections/all'), navLink('Journal', '/blogs/news'), navLink('About', '/pages/about')],
            ),
            el('row', { name: 'Actions', style: { gap: '12px', alignItems: 'center', flexWrap: 'nowrap' }, mobile: { flexDirection: 'row' } }, [
              el('link', { name: 'Account', hidden: { mobile: true }, props: { text: 'Account', href: '/account' }, style: { color: '#334155', fontSize: '15px', fontWeight: '500', alignSelf: '' }, hover: { textDecoration: 'none', color: '#0f172a' } }),
              el('button', {
                name: 'Cart',
                props: { text: 'Cart', href: '/cart' },
                style: { alignSelf: '', paddingTop: '10px', paddingBottom: '10px', paddingLeft: '18px', paddingRight: '18px', borderRadius: '999px', fontSize: '14px' },
              }),
            ]),
          ]),
        ],
      );
    },
  },
  {
    id: 'hero-centered',
    name: 'Hero — Spotlight',
    category: 'Hero',
    spec: () =>
      el(
        'section',
        {
          name: 'Hero',
          style: {
            paddingTop: '140px',
            paddingBottom: '140px',
            backgroundColor: '#0a0a12',
            backgroundImage: 'radial-gradient(60% 70% at 50% 0%, rgba(124,108,255,0.38) 0%, rgba(10,10,18,0) 100%)',
          },
          tablet: { paddingTop: '112px', paddingBottom: '112px' },
          mobile: { paddingTop: '88px', paddingBottom: '88px' },
          liquid: { sectionName: 'Hero spotlight', bgSetting: true, paddingSettings: true },
        },
        [
          animateKids(el('container', { name: 'Content', stagger: 110, style: { ...WRAP, maxWidth: '860px', alignItems: 'center', textAlign: 'center', gap: '24px' } }, [
            text(
              'New — The Spring 2026 collection',
              {
                paddingTop: '6px',
                paddingBottom: '6px',
                paddingLeft: '14px',
                paddingRight: '14px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#c4b8ff',
                fontSize: '13px',
                fontWeight: '500',
                lineHeight: '1.4',
              },
              'Badge',
              { fontSize: '13px' },
            ),
            heading(
              'Designed for the way you move',
              1,
              { fontSize: '68px', lineHeight: '1.04', letterSpacing: '-0.035em', color: '#ffffff' },
              { fontSize: '54px' },
              { fontSize: '40px' },
            ),
            text(
              'Performance essentials engineered for comfort, built with recycled materials and made to keep up with every part of your day.',
              { fontSize: '19px', color: '#a1a1b5', maxWidth: '620px' },
              'Subheading',
              { fontSize: '17px' },
            ),
            el('row', { name: 'Buttons', style: { gap: '12px', justifyContent: 'center', paddingTop: '8px' }, mobile: { flexDirection: 'row' } }, [
              btnLight('Shop the collection'),
              btnOutline('Watch the film'),
            ]),
          ])),
        ],
      ),
  },
  {
    id: 'hero-split',
    name: 'Hero — Split image',
    category: 'Hero',
    spec: () =>
      el(
        'section',
        {
          name: 'Image hero',
          style: { paddingTop: '96px', paddingBottom: '96px', backgroundColor: '#f6f3ee' },
          liquid: { sectionName: 'Image hero', bgSetting: true, paddingSettings: true },
        },
        [
          el('row', { name: 'Layout', style: { ...WRAP, alignItems: 'center', gap: '64px' }, tablet: { gap: '48px' }, mobile: { gap: '40px' } }, [
            el('container', { name: 'Text', style: { flex: '1 1 0', minWidth: '0', gap: '22px' } }, [
              eyebrow('Spring / Summer 26', '#b45309'),
              heading(
                'Everyday pieces, made to last.',
                1,
                { fontFamily: SERIF, fontSize: '62px', fontWeight: '600', lineHeight: '1.04', letterSpacing: '-0.02em', color: '#1c1917' },
                { fontSize: '48px' },
                { fontSize: '38px' },
              ),
              text(
                'Thoughtfully designed essentials in natural fabrics — cut to fit beautifully and built to be worn for years, not seasons.',
                { fontSize: '18px', color: '#57534e', maxWidth: '480px' },
                'Subheading',
              ),
              el('row', { name: 'Actions', style: { gap: '24px', alignItems: 'center', paddingTop: '8px' }, mobile: { flexDirection: 'row' } }, [
                el('button', {
                  name: 'Button',
                  props: { text: 'Shop new arrivals', href: '/collections/all' },
                  style: { backgroundColor: '#1c1917', borderRadius: '999px', paddingLeft: '30px', paddingRight: '30px', alignSelf: '' },
                  hover: { backgroundColor: '#44403c' },
                }),
                el('link', { name: 'Link', props: { text: 'Our story →' }, style: { color: '#1c1917', alignSelf: '' } }),
              ]),
            ]),
            el('container', { name: 'Media', style: { flex: '1 1 0', minWidth: '0' } }, [
              el('image', {
                name: 'Hero image',
                props: { src: unsplash('photo-1441986300917-64674bd600d8'), alt: 'Our flagship store' },
                style: { aspectRatio: '4 / 5', borderRadius: '24px' },
                mobile: { aspectRatio: '4 / 3', borderRadius: '18px' },
              }),
            ]),
          ]),
        ],
      ),
  },
  {
    id: 'logos',
    name: 'Logo cloud',
    category: 'Social proof',
    spec: () =>
      el(
        'section',
        {
          name: 'Logo cloud',
          style: { paddingTop: '48px', paddingBottom: '48px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#f1f5f9' },
          tablet: { paddingTop: '40px', paddingBottom: '40px' },
          mobile: { paddingTop: '36px', paddingBottom: '36px' },
          liquid: { sectionName: 'Logo cloud' },
        },
        [
          el('container', { name: 'Wrapper', style: { ...WRAP, alignItems: 'center', gap: '28px' } }, [
            text('Trusted by teams at forward-thinking brands', { fontSize: '14px', color: '#64748b', fontWeight: '500', textAlign: 'center' }, 'Caption', { fontSize: '14px' }),
            el(
              'row',
              {
                name: 'Logos',
                style: { width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: '40px' },
                tablet: { justifyContent: 'center', gap: '36px' },
                mobile: { flexDirection: 'row', justifyContent: 'center', gap: '20px 32px' },
                liquid: { blocks: true, blockName: 'Logo' },
              },
              ['Northwind', 'Lumen', 'Arcadia', 'Vertex', 'Halcyon', 'Oakline'].map((n) =>
                text(n, { fontFamily: GROTESK, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.03em', color: '#94a3b8', lineHeight: '1.2' }, 'Logo', { fontSize: '20px' }),
              ),
            ),
          ]),
        ],
      ),
  },
  {
    id: 'features',
    name: 'Feature grid',
    category: 'Features',
    spec: () => {
      const card = (icon: string, title: string, body: string) =>
        el(
          'container',
          {
            name: 'Feature',
            style: {
              paddingTop: '28px',
              paddingBottom: '28px',
              paddingLeft: '28px',
              paddingRight: '28px',
              gap: '14px',
              backgroundColor: '#ffffff',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#eceef3',
              borderRadius: '16px',
              transition: 'all 0.25s ease',
            },
            hover: { boxShadow: '0 16px 40px -16px rgba(15,23,42,0.18)', transform: 'translateY(-3px)', borderColor: '#dfe2f5' },
            entrance: rise(),
          },
          [
            el('icon', { name: 'Icon', props: { icon } }),
            heading(title, 3, { fontSize: '19px', fontWeight: '600', letterSpacing: '-0.01em', paddingTop: '4px' }, { fontSize: '19px' }, { fontSize: '18px' }, 'Title'),
            text(body, { fontSize: '15px', lineHeight: '1.6' }, 'Description', { fontSize: '15px' }),
          ],
        );
      return el('section', { name: 'Feature grid', liquid: { sectionName: 'Feature grid', bgSetting: true, paddingSettings: true } }, [
        el('container', { name: 'Wrapper', style: { ...WRAP, gap: '56px' }, mobile: { gap: '40px' } }, [
          sectionHeader('Why shop with us', 'Everything you need. Nothing you don’t.', 'We obsess over the details so you don’t have to — from sourcing and craft to shipping and after-sale care.'),
          el('grid', { name: 'Features', stagger: 90, style: { gap: '20px' }, liquid: { blocks: true, blockName: 'Feature' } }, [
            card('Truck', 'Free shipping', 'Complimentary express delivery on every order over $75, tracked door to door.'),
            card('RotateCcw', '30-day returns', 'Changed your mind? Send it back within 30 days for a full refund. No forms.'),
            card('ShieldCheck', '2-year warranty', 'Every product is covered against defects for two full years after purchase.'),
            card('Leaf', 'Responsibly made', 'Recycled and organic materials, produced in audited, fair-wage facilities.'),
            card('Headphones', 'Real human support', 'Talk to an actual person 7 days a week — average reply time under 2 hours.'),
            card('Lock', 'Secure checkout', 'Encrypted payments with all major cards, Shop Pay, Apple Pay and Google Pay.'),
          ]),
        ]),
      ]);
    },
  },
  {
    id: 'image-text',
    name: 'Image with text',
    category: 'Content',
    spec: () =>
      el('section', { name: 'Image with text', liquid: { sectionName: 'Image with text', bgSetting: true, paddingSettings: true } }, [
        el('row', { name: 'Layout', style: { ...WRAP, alignItems: 'center', gap: '72px' }, tablet: { gap: '48px' }, mobile: { gap: '32px' } }, [
          el('container', { name: 'Media', style: { flex: '1 1 0', minWidth: '0' } }, [
            el('image', {
              name: 'Image',
              props: { src: unsplash('photo-1523275335684-37898b6baf30'), alt: 'Product detail' },
              style: { aspectRatio: '1 / 1', borderRadius: '24px' },
              entrance: { ...DEFAULT_ENTRANCE, type: 'zoom-out', duration: 1100 },
              mobile: { borderRadius: '18px' },
            }),
          ]),
          el('container', { name: 'Content', style: { flex: '1 1 0', minWidth: '0', gap: '20px' } }, [
            eyebrow('Craftsmanship'),
            heading('Designed in-house. Tested for years.', 2, { fontSize: '42px' }, { fontSize: '34px' }, { fontSize: '30px' }),
            text('Every piece starts as a sketch in our studio and goes through months of wear-testing before it ever reaches you. The result: products that feel as good on day 1,000 as they do on day one.'),
            el('list', {
              name: 'Benefits',
              props: { items: ['Premium materials, sourced responsibly', 'Free lifetime repairs on every piece', 'Carbon-neutral shipping worldwide'] },
              style: { color: '#334155', gap: '10px' },
            }),
            el('button', { name: 'Button', props: { text: 'Discover the process' }, style: { marginTop: '8px' } }),
          ]),
        ]),
      ]),
  },
  {
    id: 'collection',
    name: 'Product grid',
    category: 'Commerce',
    spec: () => {
      const product = (name: string, price: string, img: string) =>
        el('container', { name: 'Product', style: { gap: '14px' } }, [
          el('image', {
            name: 'Product image',
            props: { src: unsplash(img, 800), alt: name },
            style: { aspectRatio: '3 / 4', borderRadius: '14px', backgroundColor: '#e7e5e4', transition: 'transform 0.4s ease' },
            hover: { transform: 'scale(1.02)' },
          }),
          el('container', { name: 'Info', style: { gap: '4px' } }, [
            heading(name, 3, { fontSize: '16px', fontWeight: '600', letterSpacing: '0', color: '#1c1917', lineHeight: '1.4' }, { fontSize: '16px' }, { fontSize: '15px' }, 'Product name'),
            text(price, { fontSize: '15px', color: '#78716c', lineHeight: '1.4' }, 'Price', { fontSize: '14px' }),
          ]),
        ]);
      return el(
        'section',
        { name: 'Product grid', style: { backgroundColor: '#fafaf9' }, liquid: { sectionName: 'Product grid', bgSetting: true, paddingSettings: true } },
        [
          el('container', { name: 'Wrapper', style: { ...WRAP, gap: '40px' }, mobile: { gap: '28px' } }, [
            el('row', { name: 'Header', style: { justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }, mobile: { alignItems: 'flex-start', gap: '12px' } }, [
              el('container', { name: 'Title', style: { gap: '10px' } }, [
                eyebrow('Best sellers', '#b45309'),
                heading('Shop the favourites', 2, { fontSize: '40px', color: '#1c1917' }, { fontSize: '34px' }, { fontSize: '28px' }),
              ]),
              el('link', { name: 'View all', props: { text: 'View all products →', href: '/collections/all' }, style: { color: '#1c1917', alignSelf: '' } }),
            ]),
            el(
              'grid',
              {
                name: 'Products',
                style: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px' },
                tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
                mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' },
                liquid: { blocks: true, blockName: 'Product' },
              },
              [
                product('Studio Headphones', '$249.00', 'photo-1505740420928-5e560c06d30e'),
                product('Everyday Runner', '$129.00', 'photo-1542291026-7eec264c27ff'),
                product('Classic Chronograph', '$189.00', 'photo-1523275335684-37898b6baf30'),
                product('Instant Camera', '$159.00', 'photo-1526170375885-4d8ecf77b99f'),
              ],
            ),
          ]),
        ],
      );
    },
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    category: 'Social proof',
    spec: () => {
      const card = (quote: string, name: string, role: string) =>
        el(
          'container',
          {
            name: 'Testimonial',
            style: {
              paddingTop: '28px',
              paddingBottom: '28px',
              paddingLeft: '28px',
              paddingRight: '28px',
              gap: '18px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            },
          },
          [
            text('★★★★★', { color: '#f59e0b', fontSize: '16px', letterSpacing: '0.15em', lineHeight: '1' }, 'Rating', { fontSize: '16px' }),
            text(quote, { fontSize: '16px', color: '#1e293b', lineHeight: '1.7', flex: '1 1 auto' }, 'Quote', { fontSize: '16px' }),
            el('container', { name: 'Author', style: { gap: '2px' } }, [
              text(name, { fontSize: '15px', fontWeight: '600', color: '#0f172a', lineHeight: '1.5' }, 'Name', { fontSize: '15px' }),
              text(role, { fontSize: '14px', color: '#64748b', lineHeight: '1.5' }, 'Role', { fontSize: '14px' }),
            ]),
          ],
        );
      return el('section', { name: 'Testimonials', style: { backgroundColor: '#f8fafc' }, liquid: { sectionName: 'Testimonials', bgSetting: true, paddingSettings: true } }, [
        el('container', { name: 'Wrapper', style: { ...WRAP, gap: '48px' }, mobile: { gap: '32px' } }, [
          sectionHeader('Reviews', 'Loved by 40,000+ customers'),
          el('grid', { name: 'Testimonials', style: { gap: '20px' }, liquid: { blocks: true, blockName: 'Testimonial' } }, [
            card('“The quality is unreal for the price. I’ve washed my tee thirty times and it still looks brand new.”', 'Maya R.', 'Verified buyer'),
            card('“Ordered on Monday, arrived Wednesday. The packaging felt premium and the fit was exactly as described.”', 'James T.', 'Verified buyer'),
            card('“Customer support actually cares. They swapped my size in a day, no questions asked. Customer for life.”', 'Priya S.', 'Verified buyer'),
          ]),
        ]),
      ]);
    },
  },
  {
    id: 'stats',
    name: 'Stats band',
    category: 'Social proof',
    spec: () => {
      const stat = (value: string, label: string) =>
        el('container', { name: 'Stat', style: { gap: '6px', alignItems: 'center', textAlign: 'center' } }, [
          heading(value, 3, { fontSize: '48px', color: '#ffffff', letterSpacing: '-0.03em', lineHeight: '1.1' }, { fontSize: '44px' }, { fontSize: '36px' }, 'Value'),
          text(label, { fontSize: '15px', color: '#c7d2fe' }, 'Label', { fontSize: '14px' }),
        ]);
      return el(
        'section',
        {
          name: 'Stats',
          style: { paddingTop: '72px', paddingBottom: '72px', backgroundColor: '#4f46e5' },
          tablet: { paddingTop: '64px', paddingBottom: '64px' },
          mobile: { paddingTop: '56px', paddingBottom: '56px' },
          liquid: { sectionName: 'Stats band', bgSetting: true },
        },
        [
          el(
            'grid',
            {
              name: 'Stats',
              style: { ...WRAP, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '32px' },
              tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
              mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '32px 16px' },
              liquid: { blocks: true, blockName: 'Stat' },
            },
            [stat('40k+', 'Happy customers'), stat('4.9/5', 'Average rating'), stat('120+', 'Countries shipped'), stat('24/7', 'Human support')],
          ),
        ],
      );
    },
  },
  {
    id: 'faq',
    name: 'FAQ',
    category: 'Content',
    spec: () => {
      const q = (question: string, answer: string) =>
        el(
          'container',
          {
            name: 'Question',
            style: { paddingTop: '22px', paddingBottom: '22px', gap: '8px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#e5e7eb' },
          },
          [
            heading(question, 3, { fontSize: '17px', fontWeight: '600', letterSpacing: '-0.01em', lineHeight: '1.4' }, { fontSize: '17px' }, { fontSize: '16px' }, 'Question'),
            text(answer, { fontSize: '15px' }, 'Answer', { fontSize: '15px' }),
          ],
        );
      return el('section', { name: 'FAQ', liquid: { sectionName: 'FAQ', bgSetting: true, paddingSettings: true } }, [
        el('row', { name: 'Layout', style: { ...WRAP, gap: '64px', alignItems: 'flex-start' }, mobile: { gap: '24px' } }, [
          el('container', { name: 'Intro', style: { flex: '1 1 0', minWidth: '0', gap: '16px', position: 'sticky', top: '32px' }, mobile: { position: 'static' } }, [
            eyebrow('Support'),
            heading('Frequently asked questions', 2, { fontSize: '40px' }, { fontSize: '34px' }, { fontSize: '28px' }),
            text('Can’t find what you’re looking for? Our team usually replies within a couple of hours.'),
            el('link', { name: 'Link', props: { text: 'Contact support →', href: '#' } }),
          ]),
          el('container', { name: 'Questions', style: { flex: '1.4 1 0', minWidth: '0', gap: '0' }, liquid: { blocks: true, blockName: 'Question' } }, [
            q('How long does shipping take?', 'Orders ship within 24 hours. Domestic delivery takes 2–4 business days; international orders arrive in 5–10 business days.'),
            q('What is your return policy?', 'You can return any unworn item within 30 days for a full refund. Returns are free and we’ll email you a prepaid label.'),
            q('Do you ship internationally?', 'Yes — we ship to over 120 countries. Duties and taxes are calculated at checkout so there are no surprises on delivery.'),
            q('How should I care for my order?', 'Machine wash cold, inside out, and hang to dry. Every product page lists detailed care instructions for that piece.'),
          ]),
        ]),
      ]);
    },
  },
  {
    id: 'marquee',
    name: 'Scrolling marquee',
    category: 'Motion',
    spec: () =>
      el(
        'section',
        {
          name: 'Marquee band',
          style: { paddingTop: '22px', paddingBottom: '22px', paddingLeft: '0', paddingRight: '0', backgroundColor: '#d9f99d' },
          tablet: { paddingTop: '18px', paddingBottom: '18px' },
          mobile: { paddingTop: '14px', paddingBottom: '14px', paddingLeft: '0', paddingRight: '0' },
          liquid: { sectionName: 'Marquee band', bgSetting: true },
        },
        [
          el(
            'marquee',
            { name: 'Marquee', props: { speed: 28, copies: 3 }, style: { gap: '40px', paddingTop: '0', paddingBottom: '0' }, liquid: { blocks: true, blockName: 'Message' } },
            ['Free shipping over $75', '✦', 'New drops every Friday', '✦', '30-day easy returns', '✦', 'Made to last', '✦'].map((t) =>
              text(t, { fontFamily: GROTESK, fontSize: '26px', fontWeight: '700', letterSpacing: '-0.02em', color: '#1a2e05', whiteSpace: 'nowrap', lineHeight: '1.2' }, 'Message', { fontSize: '20px' }),
            ),
          ),
        ],
      ),
  },
  {
    id: 'carousel',
    name: 'Product carousel',
    category: 'Motion',
    spec: () => {
      const slide = (name: string, price: string, img: string) =>
        el('container', { name: 'Slide', style: { gap: '12px' } }, [
          el('image', { name: 'Image', props: { src: unsplash(img, 900), alt: name }, style: { aspectRatio: '4 / 5', borderRadius: '18px', backgroundColor: '#e7e5e4' } }),
          heading(name, 3, { fontSize: '17px', fontWeight: '600', letterSpacing: '0', color: '#1c1917', lineHeight: '1.4' }, { fontSize: '17px' }, { fontSize: '16px' }, 'Name'),
          text(price, { fontSize: '15px', color: '#78716c', lineHeight: '1.4' }, 'Price', { fontSize: '14px' }),
        ]);
      return el('section', { name: 'Product carousel', style: { backgroundColor: '#fafaf9' }, liquid: { sectionName: 'Product carousel', bgSetting: true, paddingSettings: true } }, [
        el('container', { name: 'Wrapper', style: { ...WRAP, gap: '36px' } }, [
          el('container', { name: 'Header', style: { gap: '10px' }, entrance: rise() }, [
            eyebrow('Shop the look', '#b45309'),
            heading('Picked for the season', 2, { fontSize: '40px', color: '#1c1917' }, { fontSize: '34px' }, { fontSize: '28px' }),
          ]),
          el(
            'slider',
            {
              name: 'Carousel',
              props: { perView: { desktop: 3.4, tablet: 2.3, mobile: 1.3 }, autoplay: 0, loop: false, arrows: true, dots: true },
              style: { gap: '20px', color: '#1c1917' },
              liquid: { blocks: true, blockName: 'Slide' },
            },
            [
              slide('Studio Headphones', '$249.00', 'photo-1505740420928-5e560c06d30e'),
              slide('Everyday Runner', '$129.00', 'photo-1542291026-7eec264c27ff'),
              slide('Classic Chronograph', '$189.00', 'photo-1523275335684-37898b6baf30'),
              slide('Instant Camera', '$159.00', 'photo-1526170375885-4d8ecf77b99f'),
              slide('Court Sneaker', '$139.00', 'photo-1491553895911-0055eca6402d'),
              slide('Everyday Backpack', '$119.00', 'photo-1553062407-98eeb64c6a62'),
            ],
          ),
        ]),
      ]);
    },
  },
  {
    id: 'cta',
    name: 'CTA banner',
    category: 'Conversion',
    spec: () =>
      el('section', { name: 'CTA banner', liquid: { sectionName: 'CTA banner', bgSetting: true, paddingSettings: true } }, [
        el(
          'container',
          {
            name: 'Card',
            style: {
              ...WRAP,
              alignItems: 'center',
              textAlign: 'center',
              gap: '20px',
              paddingTop: '72px',
              paddingBottom: '72px',
              paddingLeft: '48px',
              paddingRight: '48px',
              borderRadius: '28px',
              backgroundColor: '#111827',
              backgroundImage: 'linear-gradient(135deg, #312e81 0%, #111827 55%, #0b1120 100%)',
              overflow: 'hidden',
            },
            tablet: { paddingTop: '56px', paddingBottom: '56px', paddingLeft: '40px', paddingRight: '40px' },
            mobile: { paddingTop: '44px', paddingBottom: '44px', paddingLeft: '24px', paddingRight: '24px', borderRadius: '20px' },
          },
          [
            heading('Join the club & get 15% off your first order', 2, { fontSize: '42px', color: '#ffffff', maxWidth: '720px' }, { fontSize: '34px' }, { fontSize: '28px' }),
            text('Early access to new drops, members-only offers and a little inspiration in your inbox. Never spam.', { color: '#c7d2fe', maxWidth: '560px' }, 'Subheading'),
            el('row', { name: 'Buttons', style: { gap: '12px', justifyContent: 'center', paddingTop: '8px' }, mobile: { flexDirection: 'row' } }, [
              btnLight('Become a member'),
              btnOutline('Learn more'),
            ]),
          ],
        ),
      ]),
  },
];

TEMPLATES.push({
  id: 'footer',
  name: 'Footer — Columns',
  category: 'Footer',
  spec: () => {
    const footLink = (label: string, href = '#') =>
      el('link', { name: 'Link', props: { text: label, href }, style: { color: '#94a3b8', fontSize: '14px', fontWeight: '400', alignSelf: '' }, hover: { color: '#ffffff', textDecoration: 'none' } });
    const column = (title: string, links: [string, string?][]) =>
      el('container', { name: `${title} column`, style: { gap: '14px' } }, [
        text(title, { fontSize: '13px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', lineHeight: '1.4' }, 'Column title', { fontSize: '13px' }),
        el('container', { name: 'Links', style: { gap: '10px' } }, links.map(([l, h]) => footLink(l, h))),
      ]);
    return el(
      'section',
      {
        name: 'Footer',
        props: { tag: 'footer' },
        style: { paddingTop: '72px', paddingBottom: '32px', backgroundColor: '#0f172a' },
        tablet: { paddingTop: '60px', paddingBottom: '28px' },
        mobile: { paddingTop: '48px', paddingBottom: '24px' },
        liquid: { sectionName: 'Footer', bgSetting: true },
      },
      [
        el('container', { name: 'Wrapper', style: { ...WRAP, gap: '48px' }, mobile: { gap: '36px' } }, [
          el(
            'grid',
            {
              name: 'Columns',
              style: { gridTemplateColumns: 'minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))', gap: '40px' },
              tablet: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
              mobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '32px 20px' },
            },
            [
              el('container', { name: 'Brand', style: { gap: '14px', maxWidth: '320px' }, tablet: { gridColumn: '1 / -1' }, mobile: { gridColumn: '1 / -1' } }, [
                text('Northwind', { fontFamily: GROTESK, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.04em', color: '#ffffff', lineHeight: '1.2' }, 'Logo', { fontSize: '22px' }),
                text('Thoughtfully made essentials, designed to be worn for years. Carbon-neutral shipping on every order.', { fontSize: '14px', color: '#94a3b8', lineHeight: '1.65' }, 'About', { fontSize: '14px' }),
              ]),
              column('Shop', [['New arrivals', '/collections/all'], ['Best sellers', '/collections/all'], ['Gift cards', '/products/gift-card'], ['Sale', '/collections/sale']]),
              column('Company', [['About us', '/pages/about'], ['Journal', '/blogs/news'], ['Sustainability', '/pages/sustainability'], ['Careers', '/pages/careers']]),
              column('Help', [['Shipping', '/policies/shipping-policy'], ['Returns', '/policies/refund-policy'], ['Contact', '/pages/contact'], ['FAQ', '/pages/faq']]),
            ],
          ),
          el('divider', { name: 'Divider', style: { backgroundColor: 'rgba(255,255,255,0.1)' } }),
          el('row', { name: 'Bottom bar', style: { justifyContent: 'space-between', alignItems: 'center', gap: '12px' }, mobile: { gap: '12px' } }, [
            text('© 2026 Northwind. All rights reserved.', { fontSize: '13px', color: '#64748b', lineHeight: '1.5' }, 'Copyright', { fontSize: '13px' }),
            el('row', { name: 'Legal', style: { gap: '20px' }, mobile: { flexDirection: 'row' } }, [footLink('Privacy', '/policies/privacy-policy'), footLink('Terms', '/policies/terms-of-service')]),
          ]),
        ]),
      ],
    );
  },
});

export function demoDoc(): Doc {
  const pick = (id: string) => TEMPLATES.find((t) => t.id === id)!.spec();
  return docFromSpecs(
    ['announcement', 'header', 'hero-split', 'logos', 'features', 'image-text', 'collection', 'testimonials', 'faq', 'cta', 'footer'].map(pick),
    'Demo storefront',
    { title: 'Demo storefront' },
  );
}
