'use client';

import { useEffect, useState } from 'react';

/**
 * In-page navigation for a long page (ADR-057, blueprint Phase 5): the
 * headings of what is on screen, and where the reader is in it. Built from
 * the DOM rather than passed in, so any page that renders `<h2 id=…>`
 * sections gets it without a second list to keep in step - the registry
 * decides what the sections are, and this follows.
 *
 * Hidden under `lg`: on a phone the page itself is the navigation.
 */
export interface DocNavItem {
  id: string;
  label: string;
}

export default function DocNav({ label = 'On this page' }: { label?: string }) {
  const [items, setItems] = useState<DocNavItem[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = [...document.querySelectorAll<HTMLElement>('main h2[id]')];
    // Reading the rendered document is a genuine synchronise-to-external-state,
    // not a cascade: it runs once, after the server's HTML is on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(headings.map((h) => ({ id: h.id, label: h.textContent?.trim() ?? '' })).filter((i) => i.label));
    if (headings.length === 0) return;
    // The heading nearest the top of the viewport that has not passed it.
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );
    for (const h of headings) io.observe(h);
    return () => io.disconnect();
  }, []);

  if (items.length < 2) return null;
  return (
    <nav className="hidden lg:block sticky top-24 self-start w-56 shrink-0" aria-label={label}>
      <p className="m-0 mb-3 text-label font-semibold uppercase text-muted">{label}</p>
      <ul className="m-0 p-0 list-none flex flex-col gap-1 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? 'location' : undefined}
              className={`block -ml-px pl-3 py-1 text-sm no-underline border-l transition-colors ${
                active === i.id
                  ? 'border-accent text-accent font-medium'
                  : 'border-transparent text-muted hover:text-secondary'
              }`}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
