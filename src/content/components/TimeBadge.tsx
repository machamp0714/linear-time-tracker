import { useState, useEffect } from 'react';
import { formatDuration } from '@/utils/issue-parser';

interface TimeBadgeProps {
  seconds: number;
  variant?: 'compact' | 'detail';
  isRunning?: boolean;
  startedAt?: string | null;
}

export function TimeBadge({
  seconds,
  variant = 'compact',
  isRunning = false,
  startedAt = null,
}: TimeBadgeProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startedAt) {
      // Use setTimeout to avoid synchronous setState in effect
      const id = setTimeout(() => setElapsed(0), 0);
      return () => clearTimeout(id);
    }

    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt!).getTime()) / 1000)));
    }

    // Initial tick via timeout, then interval
    const timeoutId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isRunning, startedAt]);

  const total = seconds + elapsed;

  if (total === 0 && !isRunning) return null;

  const className = variant === 'detail' ? 'tc-time-badge tc-time-badge--detail' : 'tc-time-badge';
  return <span className={className}>{formatDuration(total)}</span>;
}
