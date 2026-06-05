import { cn } from '@/lib/utils';

interface SEOScoreRingProps {
  score: number;
  size?: number;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getStrokeColor(score: number): string {
  if (score >= 80) return 'stroke-green-500';
  if (score >= 60) return 'stroke-yellow-500';
  return 'stroke-red-500';
}

export function SEOScoreRing({
  score,
  size = 64,
  label,
  className,
  showLabel = true,
}: SEOScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const strokeWidth = size < 48 ? 4 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-all duration-500', getStrokeColor(clamped))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold', getScoreColor(clamped), size < 48 ? 'text-sm' : 'text-lg')}>
            {clamped}
          </span>
          {size >= 48 && (
            <span className="text-[10px] text-muted-foreground">/100</span>
          )}
        </div>
      </div>
      {showLabel && label && (
        <span className="text-xs text-muted-foreground text-center">{label}</span>
      )}
    </div>
  );
}
