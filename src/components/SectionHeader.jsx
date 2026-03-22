// SectionHeader — pure Tailwind utilities, no custom CSS classes
export default function SectionHeader({ label, title, description }) {
  return (
    <div className="mb-10 md:mb-12">
      {label && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-[var(--accent-glow)] text-[var(--accent)] mb-3">
          {label}
        </span>
      )}
      {title && (
        <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight tracking-tight">
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-3 text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
