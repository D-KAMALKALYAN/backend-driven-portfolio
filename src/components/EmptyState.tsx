import type { ReactNode } from 'react';
import { CircleDashed } from 'lucide-react';

export interface EmptyStateProps {
  /** A lucide icon element; sized by the caller (24 reads right in this box). */
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = <CircleDashed size={24} aria-hidden />,
  title = 'No data available',
  description = 'Content will appear here once added.',
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-4 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-subtle text-muted flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-secondary mb-1">{title}</p>
      <p className="text-sm text-muted max-w-xs">{description}</p>
    </div>
  );
}
