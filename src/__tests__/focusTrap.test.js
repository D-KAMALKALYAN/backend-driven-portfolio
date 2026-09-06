import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFocusable } from '../hooks/useFocusTrap';

/**
 * getFocusable decides what the trap can move focus to, so its edge cases are
 * the ones that matter: a trap that misses the last focusable element lets
 * Tab escape, and one that includes a hidden element sends focus nowhere
 * visible.
 */

let root;

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => {
  root.remove();
  document.body.style.overflow = '';
});

describe('getFocusable', () => {
  it('finds the standard interactive elements in tab order', () => {
    root.innerHTML = `
      <a href="/x">link</a>
      <button>btn</button>
      <input />
      <select></select>
      <textarea></textarea>
      <div tabindex="0">custom</div>
    `;
    const found = getFocusable(root).map((el) => el.tagName.toLowerCase());
    expect(found).toEqual(['a', 'button', 'input', 'select', 'textarea', 'div']);
  });

  it('skips disabled controls', () => {
    root.innerHTML = `<button disabled>no</button><button>yes</button>`;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('yes');
  });

  it('skips tabindex="-1"', () => {
    root.innerHTML = `<div tabindex="-1">no</div><div tabindex="0">yes</div>`;
    expect(getFocusable(root)).toHaveLength(1);
  });

  // Regression: the selector's `button:not([disabled])` matched buttons that
  // carry tabindex="-1", so the command palette's arrow-navigated options -
  // correctly outside the tab sequence for a combobox - were treated as tab
  // stops. That made the computed "last" element one the browser never
  // focuses, so the wrap never fired and focus walked out of the dialog.
  it('skips tabindex="-1" on buttons and links, not just divs', () => {
    root.innerHTML = `
      <button tabindex="-1" role="option">arrow-navigated</button>
      <a href="/x" tabindex="-1">not a tab stop</a>
      <button>real tab stop</button>
    `;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('real tab stop');
  });

  it('skips aria-hidden subtree members', () => {
    root.innerHTML = `<button aria-hidden="true">no</button><button>yes</button>`;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('yes');
  });

  it('skips anchors without href', () => {
    root.innerHTML = `<a>no</a><a href="/y">yes</a>`;
    expect(getFocusable(root)).toHaveLength(1);
  });

  it('skips hidden inputs', () => {
    root.innerHTML = `<input type="hidden" /><input type="text" />`;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].type).toBe('text');
  });

  it('skips display:none and visibility:hidden', () => {
    root.innerHTML = `
      <button style="display:none">no</button>
      <button style="visibility:hidden">no</button>
      <button>yes</button>
    `;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('yes');
  });

  it('skips [hidden] elements and their descendants', () => {
    root.innerHTML = `<div hidden><button>no</button></div><button>yes</button>`;
    const found = getFocusable(root);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('yes');
  });

  // Regression: an earlier version filtered on offsetParent, which is null
  // for anything inside a position:fixed ancestor. Both modals in this app
  // are position:fixed, so it reported them as entirely unfocusable.
  it('finds elements inside a position:fixed ancestor', () => {
    root.innerHTML = `<div style="position:fixed"><button>in a fixed modal</button></div>`;
    expect(getFocusable(root)).toHaveLength(1);
  });

  it('returns an empty list for null or empty containers', () => {
    expect(getFocusable(null)).toEqual([]);
    expect(getFocusable(document.createElement('div'))).toEqual([]);
  });

  it('finds elements nested at any depth', () => {
    root.innerHTML = `<div><section><p><button>deep</button></p></section></div>`;
    expect(getFocusable(root)).toHaveLength(1);
  });

  // The trap wraps from the last element to the first, so identifying the
  // real last element is what stops Tab escaping the modal.
  it('reports first and last correctly for wrap-around', () => {
    root.innerHTML = `<button>one</button><input /><a href="/z">three</a>`;
    const items = getFocusable(root);
    expect(items[0].textContent).toBe('one');
    expect(items[items.length - 1].textContent).toBe('three');
  });
});
