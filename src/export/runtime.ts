import type { Doc } from '../types';

/**
 * The tiny runtime shipped with exports that use motion.
 *
 * Progressive enhancement: nothing is hidden unless the script has run (it adds `.ss-js` to <html>),
 * so without JS every element is simply visible, marquees still scroll (pure CSS), and slideshows
 * fall back to a swipeable scroll-snap row. prefers-reduced-motion disables all of it.
 */

export const RUNTIME_CSS = `/* SectionForge motion runtime */
.ss-js [data-ss-anim]:not([data-ss-done]) {
  opacity: 0;
  transition-property: opacity, translate, scale, filter;
  transition-duration: var(--ss-dur, 700ms);
  transition-timing-function: var(--ss-ease, cubic-bezier(0.22, 1, 0.36, 1));
  transition-delay: calc(var(--ss-delay, 0ms) + var(--ss-i, 0) * var(--ss-stagger, 0ms));
}
.ss-js [data-ss-anim='slide-up']:not([data-ss-done]) {
  translate: 0 var(--ss-dist, 32px);
}
.ss-js [data-ss-anim='slide-down']:not([data-ss-done]) {
  translate: 0 calc(var(--ss-dist, 32px) * -1);
}
.ss-js [data-ss-anim='slide-left']:not([data-ss-done]) {
  translate: var(--ss-dist, 32px) 0;
}
.ss-js [data-ss-anim='slide-right']:not([data-ss-done]) {
  translate: calc(var(--ss-dist, 32px) * -1) 0;
}
.ss-js [data-ss-anim='zoom-in']:not([data-ss-done]) {
  scale: 0.92;
}
.ss-js [data-ss-anim='zoom-out']:not([data-ss-done]) {
  scale: 1.08;
}
.ss-js [data-ss-anim='blur']:not([data-ss-done]) {
  filter: blur(14px);
}
.ss-js [data-ss-anim].ss-in:not([data-ss-done]) {
  opacity: 1;
  translate: none;
  scale: none;
  filter: none;
}
.ss-marquee {
  overflow: hidden;
}
.ss-mq-track {
  display: flex;
  width: max-content;
  animation: ss-marquee var(--ss-speed, 30s) linear infinite;
}
.ss-marquee[data-dir='right'] .ss-mq-track {
  animation-direction: reverse;
}
.ss-marquee[data-pause]:hover .ss-mq-track {
  animation-play-state: paused;
}
.ss-mq-group {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--ss-gap, 48px);
  padding-right: var(--ss-gap, 48px);
}
.ss-mq-dup {
  display: contents;
}
@keyframes ss-marquee {
  to {
    transform: translateX(-50%);
  }
}
.ss-slider,
.ss-slider-viewport {
  position: relative;
}
.ss-slider-track {
  display: flex;
  gap: var(--ss-gap, 20px);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.ss-slider-track::-webkit-scrollbar {
  display: none;
}
.ss-slider .ss-slider-track > * {
  flex: 0 0 calc((100% - (var(--ss-per, 1) - 1) * var(--ss-gap, 20px)) / var(--ss-per, 1));
  min-width: 0;
  scroll-snap-align: start;
}
.ss-slider-btn {
  display: none;
  place-items: center;
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  z-index: 2;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
  cursor: pointer;
  transition: opacity 0.2s, scale 0.2s;
}
.ss-slider-btn:hover {
  scale: 1.06;
}
.ss-slider-btn[disabled] {
  opacity: 0;
  pointer-events: none;
}
.ss-prev {
  left: 12px;
}
.ss-next {
  right: 12px;
}
.ss-js .ss-slider[data-arrows] .ss-slider-btn {
  display: grid;
}
.ss-slider-dots {
  display: none;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}
.ss-js .ss-slider[data-dots] .ss-slider-dots {
  display: flex;
}
.ss-slider-dots button {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 99px;
  background: currentColor;
  opacity: 0.25;
  cursor: pointer;
  transition: all 0.25s;
}
.ss-slider-dots button[aria-current='true'] {
  width: 22px;
  opacity: 0.9;
}
@media (prefers-reduced-motion: reduce) {
  .ss-js [data-ss-anim] {
    opacity: 1 !important;
    translate: none !important;
    scale: none !important;
    filter: none !important;
    transition: none !important;
  }
  .ss-mq-track {
    animation: none;
  }
  .ss-slider-track {
    scroll-behavior: auto;
  }
}
`;

/** Plain ES5 so it runs in any theme without a build step. Idempotent and safe to include many times. */
export const RUNTIME_JS = `(function () {
  var d = document.documentElement;
  d.classList.add('ss-js');
  if (window.SectionForgeRuntime) return window.SectionForgeRuntime.boot();
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function done(el) { el.setAttribute('data-ss-done', ''); el.classList.remove('ss-in'); }

  function initAnim(root) {
    var els = [].slice.call(root.querySelectorAll('[data-ss-anim]:not([data-ss-done]):not([data-ss-seen])'));
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) return els.forEach(done);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        el.getBoundingClientRect(); // flush styles so the transition starts from the hidden state
        el.classList.add('ss-in');
        var cs = getComputedStyle(el);
        var t = (parseFloat(cs.transitionDuration) || 0.7) + (parseFloat(cs.transitionDelay) || 0);
        setTimeout(function () { done(el); }, t * 1000 + 100);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { el.setAttribute('data-ss-seen', ''); io.observe(el); });
  }

  function initSlider(root) {
    if (root.__ssSlider) return;
    root.__ssSlider = true;
    var track = root.querySelector('.ss-slider-track');
    if (!track) return;
    var prev = root.querySelector('.ss-prev'), next = root.querySelector('.ss-next');
    var dots = root.querySelector('.ss-slider-dots');
    var loop = root.hasAttribute('data-loop');
    function step() {
      var s = track.children[0];
      if (!s) return track.clientWidth || 1;
      return s.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    }
    function pages() { return Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / step()) + 1); }
    function page() { return Math.round(track.scrollLeft / step()); }
    function go(i) {
      var n = pages();
      if (i < 0) i = loop ? n - 1 : 0;
      if (i > n - 1) i = loop ? 0 : n - 1;
      track.scrollTo({ left: i * step(), behavior: reduced ? 'auto' : 'smooth' });
    }
    function render() {
      var n = pages(), p = page(), i;
      if (dots) {
        if (dots.children.length !== n) {
          dots.innerHTML = '';
          for (i = 0; i < n; i++) {
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
            b.onclick = (function (k) { return function () { go(k); }; })(i);
            dots.appendChild(b);
          }
        }
        for (i = 0; i < dots.children.length; i++) dots.children[i].setAttribute('aria-current', i === p ? 'true' : 'false');
      }
      if (!loop) {
        if (prev) prev.disabled = p <= 0;
        if (next) next.disabled = p >= n - 1;
      }
    }
    if (prev) prev.onclick = function () { go(page() - 1); };
    if (next) next.onclick = function () { go(page() + 1); };
    var t;
    track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(render, 60); }, { passive: true });
    window.addEventListener('resize', render);
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(page() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(page() - 1); }
    });
    render();
    var ms = parseFloat(root.getAttribute('data-autoplay')) * 1000;
    if (ms > 0 && !reduced) {
      var paused = false;
      ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { paused = true; }, { passive: true }); });
      ['mouseleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, function () { paused = false; }); });
      setInterval(function () {
        if (paused || document.hidden) return;
        var p = page();
        go(p >= pages() - 1 ? 0 : p + 1);
      }, ms);
    }
  }

  function init(root) {
    root = root || document;
    initAnim(root);
    [].forEach.call(root.querySelectorAll('.ss-slider'), initSlider);
  }

  window.SectionForgeRuntime = { init: init, boot: function () { init(document); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  // Shopify theme editor re-renders sections in place
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
`;

export interface MotionUsage {
  entrance: boolean;
  marquee: boolean;
  slider: boolean;
}

export function motionUsage(doc: Doc, rootIds: string[]): MotionUsage {
  const u: MotionUsage = { entrance: false, marquee: false, slider: false };
  const walk = (id: string) => {
    const n = doc.nodes[id];
    if (!n) return;
    if (n.entrance) u.entrance = true;
    if (n.type === 'marquee') u.marquee = true;
    if (n.type === 'slider') u.slider = true;
    n.children.forEach(walk);
  };
  rootIds.forEach(walk);
  return u;
}

export const needsRuntimeCss = (u: MotionUsage) => u.entrance || u.marquee || u.slider;
export const needsRuntimeJs = (u: MotionUsage) => u.entrance || u.slider;

export const CHEVRON_LEFT =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
export const CHEVRON_RIGHT =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
