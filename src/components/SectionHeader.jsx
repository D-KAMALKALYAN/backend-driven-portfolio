/**
 * SectionHeader — pure Tailwind utilities, no custom CSS classes.
 *
 * Renders an `<h1>` by default because on most pages this *is* the page
 * heading. It previously hard-coded `<h2>`, which left seven of eleven pages
 * with no `<h1>` at all — a document with no top-level heading gives screen
 * reader users nothing to orient by, and search engines nothing to weight.
 *
 * Pass `as="h2"` where the component is used for a section *within* a page
 * that already has an `<h1>`, so each page keeps exactly one.
 */
export default function SectionHeader({ label, title, description, as: Heading = 'h1' }) {
  return (
    <div className="mb-10 md:mb-12">
      {label && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-[var(--accent-glow)] text-[var(--accent)] mb-3">
          {label}
        </span>
      )}
      {title && (
        <Heading className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight tracking-tight">
          {title}
        </Heading>
      )}
      {description && (
        <p className="mt-3 text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
