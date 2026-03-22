export default function EmptyState({ icon = '◇', title = 'No data available', description = 'Content will appear here once added.', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-4 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-[var(--text-secondary)] mb-1">{title}</p>
      <p className="text-sm text-[var(--text-muted)] max-w-xs">{description}</p>
    </div>
  );
}
