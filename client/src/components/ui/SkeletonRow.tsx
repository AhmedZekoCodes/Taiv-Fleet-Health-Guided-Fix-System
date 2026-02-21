// each pattern has intentionally different widths so rows don't look identical
const PATTERNS: Array<{ venue: string; label: string; badge: string; time: string; count: string }> = [
  { venue: 'w-20', label: 'w-32', badge: 'w-14', time: 'w-12', count: 'w-5' },
  { venue: 'w-16', label: 'w-40', badge: 'w-16', time: 'w-10', count: 'w-6' },
  { venue: 'w-24', label: 'w-28', badge: 'w-14', time: 'w-14', count: 'w-4' },
  { venue: 'w-18', label: 'w-36', badge: 'w-12', time: 'w-11', count: 'w-5' },
  { venue: 'w-22', label: 'w-24', badge: 'w-16', time: 'w-9',  count: 'w-6' },
  { venue: 'w-14', label: 'w-44', badge: 'w-14', time: 'w-13', count: 'w-4' },
  { venue: 'w-20', label: 'w-30', badge: 'w-12', time: 'w-10', count: 'w-7' },
  { venue: 'w-17', label: 'w-38', badge: 'w-16', time: 'w-12', count: 'w-5' },
];

interface SkeletonRowProps {
  index: number;
}

// a single placeholder row — animate-pulse delay staggers the appearance
export function SkeletonRow({ index }: SkeletonRowProps): React.ReactElement {
  const p = PATTERNS[index % PATTERNS.length];
  // stagger the pulse by 40ms per row so rows don't all fade at the same time
  const delay = `${index * 40}ms`;

  return (
    <div
      className="flex items-center gap-2 px-4 py-3.5 animate-pulse border-b border-white/5"
      style={{ animationDelay: delay }}
      role="presentation"
    >
      {/* status rail placeholder */}
      <div className="w-0.5 h-5 rounded-full bg-white/8 flex-shrink-0" />
      {/* venue */}
      <div className={`${p.venue} h-2.5 rounded bg-white/8 flex-shrink-0`} />
      {/* device label */}
      <div className={`${p.label} h-2.5 rounded bg-white/10 flex-1 max-w-full`} />
      {/* status badge */}
      <div className={`${p.badge} h-5 rounded-full bg-white/8 flex-shrink-0`} />
      {/* last seen */}
      <div className={`${p.time} h-2 rounded bg-white/7 flex-shrink-0`} />
      {/* incident count */}
      <div className={`${p.count} h-4 rounded-full bg-white/7 flex-shrink-0`} />
    </div>
  );
}

// renders N staggered skeleton rows for the loading state
export function SkeletonList({ count = 10 }: { count?: number }): React.ReactElement {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </>
  );
}
