import SkeletonCard from './SkeletonCard';

/**
 * Reusable skeleton table placeholder.
 */
export default function SkeletonTable({ rows = 5, className = '', ...props }) {
  return (
    <div className={className} {...props}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
