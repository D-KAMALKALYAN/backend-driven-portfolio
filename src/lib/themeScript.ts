/**
 * Runs before hydration so the first paint already has the right theme.
 *
 * Inline on purpose: an external script would arrive after first paint and
 * the flash it exists to prevent would be back. It is the one hand-written
 * inline script in the app, and it carries the per-request CSP nonce.
 * Reads the same key useTheme() writes.
 */
export const THEME_STORAGE_KEY = 'elite-portfolio-theme';

export const THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}` +
  `else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme:light)').matches){document.documentElement.setAttribute('data-theme','light')}}catch(e){}})();`;
