import SkeletonCard from './SkeletonCard';

/**
 * Reusable loading card placeholder.
 */
export default function LoadingCard({ className = '', ...props }) {
  return <SkeletonCard className={className} {...props} />;
}
