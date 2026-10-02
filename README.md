# SectionForge

A visual builder for web sections that exports clean **HTML**, responsive **CSS**, and **Shopify Liquid sections** (with `{% schema %}`, theme-editor settings, repeatable blocks and presets).

Runs entirely in the browser — no backend or database. Projects live in `localStorage` and can be downloaded / imported as `.json` files.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # production build in dist/
npm run validate   # renders every template's Liquid with liquidjs, checks schema rules, runtime JS and export markers
```

## Features

**Projects**
- Landing screen with all projects: new (blank or demo), import, open, rename, duplicate, download, delete — with live thumbnails and storage usage.
- Versioned document format (`src/migrate.ts`): older saves are upgraded step by step; files from a newer build are refused instead of being truncated.

**Editing**
- Drag & drop from the Elements / Sections panels (mouse or touch — long-press on touch screens), reorder on the canvas or in Layers, auto-scroll near edges.
- Double-click (or Enter) to edit text inline. Multi-select with Shift/Ctrl-click → duplicate, group (Ctrl+G) or delete.
- Deleting a section or a large subtree asks for confirmation; everything is undoable.
- Desktop / Tablet / Mobile styles (desktop-first, 989px / 749px breakpoints) and a Hover state, with coloured dots showing overrides.
- **Design tokens**: colour tokens (exported as CSS variables) and linked text styles (exported as classes). Edit a token once, every use updates.
- **Simple / Developer mode**: Simple uses plain-language labels and hides expert controls (custom CSS, class/ID, positioning, grid templates, transforms); Developer shows everything.
- **Editor theming**: Midnight, Graphite, Slate or Daylight + any accent colour — only affects the app, never the design.

**Motion**
- Scroll entrance animations (fade, slide ×4, zoom in/out, blur) with duration, delay, easing, distance, and container stagger. Preview on the canvas or with *Play motion*.
- **Marquee** (pure CSS) and **Slideshow** (slides per view per device, arrows, dots, loop, autoplay).
- Exports include a ~3 KB ES5 runtime *only when needed*. Progressive enhancement: without JS everything is visible and slideshows are swipeable; `prefers-reduced-motion` is respected; Shopify's theme editor re-initialises via `shopify:section:load`.

**Export**
- HTML (full document or snippet, linked or inline CSS), CSS, Shopify Liquid per section, or everything as a ZIP.
- Optional generated-file header with a fingerprint. **Check a file for hand edits** tells you whether a file in your theme/repo was edited after export before you overwrite it.

**Safety**
- Custom HTML embeds render in a script-less sandboxed iframe on the canvas; previews run in an opaque-origin sandbox.
- Error boundaries per panel with *Undo last change* / *Download backup*.

## Shopify export model

| Canvas element | Theme setting |
| --- | --- |
| Heading / single-line text | `inline_richtext` |
| Multi-line text | `richtext` |
| Button / link | `text` label + `url` link |
| Image | `image_picker` (falls back to the design image) |
| List | `textarea` (one item per line) |
| YouTube / Vimeo video | `video_url` |
| Icon inside a block | `select` icon picker |

- Mark any container (including sliders and marquees) as **Repeatable blocks** (Shopify tab): the first child is the block template and every child becomes a preset block.
- Root sections can expose **background colour** and **top/bottom padding** settings.
- CSS is scoped to `#shopify-section-{{ section.id }}`; "Use theme fonts" drops `font-family`.

## Structure

```
src/
  types.ts          document model (flat node map + root section ids, tokens)
  migrate.ts        schema versioning + migrations
  projects.ts       localStorage project library
  ui.ts             editor preferences (theme, accent, mode) + confirm dialog
  registry.ts       element definitions & defaults
  palette.ts        Elements panel items
  templates.ts      section library + demo page
  doc.ts            tree helpers (build/clone/move, root-placement rules)
  store.ts          zustand store: history, selection, actions, autosave
  dnd.ts            drop targeting (canvas, layers, touch), throttling, auto-scroll
  lib/              styles, fonts, icons, tokens, motion helpers, highlighter
  export/           html · css · liquid · structure (shared markup) · runtime · markers
  components/       Home, TopBar, LeftPanel, Canvas, Inspector, controls, Export/Preview modals, …
```
