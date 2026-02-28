import { formatDuration } from '@/utils/issue-parser';

interface TimeBadgeProps {
  seconds: number;
  variant?: 'compact' | 'detail';
}

export function TimeBadge({ seconds, variant = 'compact' }: TimeBadgeProps) {
  if (seconds === 0) return null;
  const className = variant === 'detail' ? 'tc-time-badge tc-time-badge--detail' : 'tc-time-badge';
  return <span className={className}>{formatDuration(seconds)}</span>;
}
