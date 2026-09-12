export function SkeletonLine({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`p-6 rounded-2xl bg-[var(--bg-card)] space-y-4 ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <SkeletonLine width="55%" height="1.25rem" />
      <SkeletonLine width="35%" height="0.75rem" />
      <div className="space-y-2 pt-1">
        <SkeletonLine height="0.875rem" />
        <SkeletonLine width="80%" height="0.875rem" />
      </div>
      <div className="flex gap-2 pt-1">
        <SkeletonLine width="3.5rem" height="1.5rem" />
        <SkeletonLine width="4rem"   height="1.5rem" />
        <SkeletonLine width="3rem"   height="1.5rem" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4, cols = 2 }: { count?: number; cols?: 2 | 3 | 4 }) {
  // Analytics asked for cols={4} and silently got the two-column grid, so
  // its four stat cards skeletoned as two rows of two.
  const g = cols === 4
    ? 'grid grid-cols-2 lg:grid-cols-4 gap-4'
    : cols === 3
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6';
  return (
    <div className={g}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonSection({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      <SkeletonLine width="14%" height="0.6875rem" />
      <SkeletonLine width="45%" height="2rem" className="mt-1" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} width={`${90 - i * 10}%`} height="0.875rem" />
        ))}
      </div>
    </div>
  );
}
