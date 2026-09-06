import { useEffect, useRef } from 'react';

/**
 * Keyboard containment for modal surfaces.
 *
 * Both modals in this app (the command palette and the experience drawer)
 * rendered over the page while leaving Tab free to walk into the content
 * behind them. For a keyboard or screen-reader user that means focus
 * disappears into a region they cannot see and cannot escape from, and
 * closing the modal drops focus back to the top of the document.
 *
 * Handles the four things a modal owes its user:
 *   1. move focus in when it opens
 *   2. keep Tab and Shift+Tab inside it
 *   3. close on Escape
 *   4. put focus back where it was when it closes
 *
 * Plus body scroll lock, so the page behind does not move.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Visible, focusable elements inside `container`, in tab order.
 *
 * Visibility is decided from computed style rather than `offsetParent`.
 * offsetParent is null for any element inside a `position: fixed` ancestor -
 * which is exactly what both modals here are - so it would have reported the
 * entire palette as invisible in a real browser, not just under test.
 */
export function getFocusable(container) {
  if (!container) return [];

  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // tabindex="-1" removes an element from the tab sequence regardless of
    // tag. The selector's `button:not([disabled])` matched such buttons, so
    // the command palette's arrow-navigated options (correctly tabIndex={-1}
    // for the combobox pattern) were treated as tab stops they never were.
    if (el.getAttribute('tabindex') === '-1') return false;
    if (el.hidden || el.closest('[hidden]')) return false;

    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;

    return true;
  });
}

/**
 * @param {{current: HTMLElement|null}} containerRef
 * @param {boolean} isActive
 * @param {{ onEscape?: () => void, initialFocusRef?: {current: HTMLElement|null}, lockScroll?: boolean }} [options]
 */
export function useFocusTrap(containerRef, isActive, options = {}) {
  const { onEscape, initialFocusRef, lockScroll = true } = options;
  const previouslyFocused = useRef(null);

  // Keep the latest onEscape without re-running the trap effect whenever the
  // caller passes a new inline callback. Assigned in an effect, not during
  // render - a ref write during render is not a safe React operation.
  const escapeRef = useRef(onEscape);
  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);

  useEffect(() => {
    if (!isActive) return undefined;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;

    // Move focus in. Prefer an explicit target (the palette's search input),
    // otherwise the first focusable, otherwise the container itself.
    const focusFirst = () => {
      const explicit = initialFocusRef?.current;
      if (explicit) { explicit.focus(); return; }
      const items = getFocusable(container);
      if (items.length > 0) { items[0].focus(); return; }
      if (container) {
        container.setAttribute('tabindex', '-1');
        container.focus();
      }
    };
    // Defer one frame so the element exists after the open animation starts.
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escapeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable(containerRef.current);
      if (items.length === 0) {
        // Nothing to focus inside: keep focus from leaving entirely.
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = containerRef.current?.contains(active);

      // Focus already outside (or on an element the browser made focusable
      // that is not in our list): pull it back to the correct end.
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    /**
     * Safety net for focus that leaves without a Tab we can intercept.
     *
     * Chrome makes any `overflow: auto` region focusable so it can be
     * scrolled by keyboard. The command palette's results list is one, and it
     * carries no tabindex - so it is not in getFocusable()'s list, neither
     * wrap branch matched when focus landed on it, and the next Tab walked
     * straight out of the dialog. Reasoning about tab order alone missed this;
     * watching where focus actually goes does not.
     */
    const onFocusIn = (e) => {
      const node = containerRef.current;
      if (!node || node.contains(e.target)) return;
      const items = getFocusable(node);
      (items[0] ?? node).focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      if (lockScroll) document.body.style.overflow = previousOverflow;

      // Return focus to whatever opened the modal, so the user resumes where
      // they left off rather than at the top of the document.
      const target = previouslyFocused.current;
      if (target && document.contains(target)) target.focus();
    };
  }, [isActive, containerRef, initialFocusRef, lockScroll]);
}
