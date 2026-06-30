// Shimmer placeholder shown while a deferred product row streams in.
export function SkeletonRow({count = 6}: {count?: number}) {
  return (
    <div className="skeleton-row" aria-hidden>
      {Array.from({length: count}).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}
