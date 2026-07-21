/**
 * Scroll the admin content area back to the top.
 *
 * The admin shell is a fixed-height flex layout: the window itself never scrolls, and
 * `#content-viewport` (see Layout.jsx) is the element that does. So `window.scrollTo(0, 0)`
 * — the reflex answer — is a silent no-op here.
 *
 * The window fallback is kept for the login screen, which renders outside the shell and
 * does scroll normally.
 *
 * @param {object}  options
 * @param {boolean} options.smooth Animate the scroll. Off for route changes (a new page
 *                                 arriving mid-animation looks like a glitch), on for
 *                                 in-page "back to top" actions where the motion tells the
 *                                 user what moved.
 */
export const scrollContentToTop = ({ smooth = false } = {}) => {
  // A user who has asked for reduced motion gets an instant jump regardless.
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior = smooth && !prefersReduced ? 'smooth' : 'auto';

  const viewport = document.getElementById('content-viewport');
  if (viewport) {
    viewport.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
};

export default scrollContentToTop;
